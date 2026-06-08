"""
Environment variable management — CRUD backed by SQLite + GitHub Secrets sync.

SQLite is the source of truth. Each save/delete syncs to the configured
GitHub environment's secrets in real time.

Values are stored AES-encrypted (Fernet) at rest, keyed from JWT_SECRET.
GitHub connection (token + repo) is stored in SQLite under reserved keys
and managed via the /github-config endpoint.
"""
import base64
import hashlib
import os
from typing import Optional

import httpx
from cryptography.fernet import Fernet, InvalidToken
from fastapi import APIRouter, Depends, HTTPException, Request, status
from nacl.encoding import RawEncoder
from nacl.public import PublicKey, SealedBox
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from auth.security import require_admin
from db.crud import create_audit_log, delete_app_config, delete_env_var, get_app_config, get_env_var, list_env_vars, set_app_config, set_env_var
from db.database import get_session
from db.models import User
from limiter import limiter

router = APIRouter()

# ── At-rest encryption ────────────────────────────────────────────────────────
_jwt_secret = os.getenv("JWT_SECRET", "changeme-set-JWT_SECRET-in-env")
_fernet = Fernet(base64.urlsafe_b64encode(hashlib.sha256(_jwt_secret.encode()).digest()))


def _enc(value: str) -> str:
    return _fernet.encrypt(value.encode()).decode()


def _dec(value: str) -> str:
    try:
        return _fernet.decrypt(value.encode()).decode()
    except InvalidToken:
        return value


# ── GitHub config ─────────────────────────────────────────────────────────────
_GITHUB_ENV = os.getenv("GITHUB_ENV", "production")
_WORKFLOW_FILE = os.getenv("GITHUB_WORKFLOW_FILE", "deploy.yml")
_GH_BASE = "https://api.github.com"
_DEV_DOTENV_PATH = os.getenv("DEV_DOTENV_PATH", "")
_RESERVED_KEYS = {"github_token", "github_repo"}


async def _get_github_config(session: AsyncSession) -> tuple[str, str]:
    """Read GitHub token and repo from app_config table, falling back to env vars."""
    token_enc = await get_app_config(session, "github_token")
    repo_enc = await get_app_config(session, "github_repo")
    token = _dec(token_enc) if token_enc else os.getenv("GITHUB_TOKEN", "")
    repo = repo_enc if repo_enc else os.getenv("GITHUB_REPO", "")
    return token, repo


def _gh_headers(token: str) -> dict:
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


# ── .env file helpers (dev mode) ──────────────────────────────────────────────

def _quote_dotenv(value: str) -> str:
    escaped = value.replace("\\", "\\\\").replace('"', '\\"')
    return f'"{escaped}"'


def _write_dotenv(path: str, new_vars: dict) -> None:
    try:
        with open(path) as f:
            lines = f.read().splitlines()
    except FileNotFoundError:
        lines = []

    written: set = set()
    result: list = []
    for line in lines:
        stripped = line.strip()
        if "=" in stripped and not stripped.startswith("#"):
            key = stripped.split("=", 1)[0].strip()
            if key in new_vars:
                result.append(f"{key}={_quote_dotenv(new_vars[key])}")
                written.add(key)
                continue
        result.append(line)

    for key, value in new_vars.items():
        if key not in written:
            result.append(f"{key}={_quote_dotenv(value)}")

    with open(path, "w") as f:
        f.write("\n".join(result) + "\n")


def _remove_from_dotenv(path: str, key: str) -> None:
    try:
        with open(path) as f:
            lines = f.read().splitlines()
    except FileNotFoundError:
        return

    result = [
        line for line in lines
        if not (
            "=" in line.strip()
            and not line.strip().startswith("#")
            and line.strip().split("=", 1)[0].strip() == key
        )
    ]

    with open(path, "w") as f:
        f.write("\n".join(result) + "\n")


def _encrypt_secret(public_key_b64: str, value: str) -> str:
    raw_key = base64.b64decode(public_key_b64)
    sealed = SealedBox(PublicKey(raw_key))
    encrypted = sealed.encrypt(value.encode(), encoder=RawEncoder)
    return base64.b64encode(encrypted).decode()


# ── GitHub sync helpers ───────────────────────────────────────────────────────

async def _push_secret_to_github(key: str, value: str, token: str, repo: str) -> None:
    if not token or not repo:
        return
    async with httpx.AsyncClient(timeout=30, headers=_gh_headers(token)) as client:
        await client.put(f"{_GH_BASE}/repos/{repo}/environments/{_GITHUB_ENV}", json={})
        pk_resp = await client.get(f"{_GH_BASE}/repos/{repo}/environments/{_GITHUB_ENV}/secrets/public-key")
        if pk_resp.status_code != 200:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"GitHub public key fetch failed: {pk_resp.text}")
        pk_data = pk_resp.json()
        encrypted = _encrypt_secret(pk_data["key"], value)
        resp = await client.put(
            f"{_GH_BASE}/repos/{repo}/environments/{_GITHUB_ENV}/secrets/{key}",
            json={"encrypted_value": encrypted, "key_id": pk_data["key_id"]},
        )
        if resp.status_code not in (201, 204):
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"GitHub secret push failed: {resp.text}")


async def _delete_secret_from_github(key: str, token: str, repo: str) -> None:
    if not token or not repo:
        return
    async with httpx.AsyncClient(timeout=30, headers=_gh_headers(token)) as client:
        resp = await client.delete(f"{_GH_BASE}/repos/{repo}/environments/{_GITHUB_ENV}/secrets/{key}")
        if resp.status_code not in (204, 404):
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"GitHub secret delete failed: {resp.text}")


# ── Schemas ───────────────────────────────────────────────────────────────────

class EnvVarBody(BaseModel):
    value: str


class EnvVarOut(BaseModel):
    key: str
    value: str
    updated_at: Optional[str]


class GitHubConfigBody(BaseModel):
    token: Optional[str] = None
    repo: Optional[str] = None


# ── GitHub config endpoint ────────────────────────────────────────────────────

@router.get("/github-config")
async def get_github_config(
    _admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    token_enc = await get_app_config(session, "github_token")
    repo = await get_app_config(session, "github_repo")
    return {"token_set": bool(token_enc), "repo": repo or ""}


@router.get("/github-config/token")
async def get_github_token(
    _admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    token_enc = await get_app_config(session, "github_token")
    if not token_enc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Token not set")
    return {"token": _dec(token_enc)}


@router.put("/github-config")
async def save_github_config(
    body: GitHubConfigBody,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    if body.token is not None:
        if body.token:
            await set_app_config(session, "github_token", _enc(body.token))
        else:
            await delete_app_config(session, "github_token")
    if body.repo is not None:
        if body.repo:
            await set_app_config(session, "github_repo", body.repo)
        else:
            await delete_app_config(session, "github_repo")
    await create_audit_log(session, action="github_config_updated", actor_id=str(admin.id), actor_name=admin.username, target_name="github_config", detail="token/repo updated")
    return {"ok": True}


# ── CRUD endpoints ────────────────────────────────────────────────────────────

@router.get("/")
async def list_vars(
    _admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    vars_ = await list_env_vars(session)
    return {"vars": [{"key": v.key, "updated_at": v.updated_at.isoformat() if v.updated_at else None} for v in vars_]}


# ── GitHub Actions endpoints ──────────────────────────────────────────────────

@router.get("/runs")
@limiter.limit("30/minute")
async def get_workflow_runs(
    request: Request,
    _admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
    per_page: int = 10,
    page: int = 1,
):
    token, repo = await _get_github_config(session)
    if not token or not repo:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="GitHub token or repo not configured")
    async with httpx.AsyncClient(timeout=15, headers=_gh_headers(token)) as client:
        resp = await client.get(
            f"{_GH_BASE}/repos/{repo}/actions/workflows/{_WORKFLOW_FILE}/runs",
            params={"per_page": min(per_page, 100), "page": page},
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"GitHub API error: {resp.text}")
    data = resp.json()
    workflow_runs = data.get("workflow_runs", [])
    runs = [
        {
            "id": r["id"],
            "run_number": r["run_number"],
            "status": r["status"],
            "conclusion": r["conclusion"],
            "name": r.get("display_title") or r.get("name") or r["event"],
            "event": r["event"],
            "created_at": r["created_at"],
            "updated_at": r["updated_at"],
            "html_url": r["html_url"],
            "actor": r["actor"]["login"] if r.get("actor") else None,
        }
        for r in workflow_runs
    ]
    return {"runs": runs, "has_more": len(workflow_runs) == per_page}


@router.get("/runs/{run_id}/jobs")
@limiter.limit("30/minute")
async def get_run_jobs(
    request: Request,
    run_id: int,
    _admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    token, repo = await _get_github_config(session)
    if not token or not repo:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="GitHub token or repo not configured")
    async with httpx.AsyncClient(timeout=15, headers=_gh_headers(token)) as client:
        resp = await client.get(f"{_GH_BASE}/repos/{repo}/actions/runs/{run_id}/jobs")
        if resp.status_code != 200:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"GitHub API error: {resp.text}")
    jobs = [
        {
            "id": j["id"],
            "name": j["name"],
            "status": j["status"],
            "conclusion": j["conclusion"],
            "started_at": j.get("started_at"),
            "completed_at": j.get("completed_at"),
            "steps": [
                {"name": s["name"], "status": s["status"], "conclusion": s["conclusion"], "number": s["number"]}
                for s in j.get("steps", [])
            ],
        }
        for j in resp.json().get("jobs", [])
    ]
    return {"jobs": jobs}


@router.get("/jobs/{job_id}/logs")
@limiter.limit("30/minute")
async def get_job_logs(
    request: Request,
    job_id: int,
    _admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    token, repo = await _get_github_config(session)
    if not token or not repo:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="GitHub token or repo not configured")
    async with httpx.AsyncClient(timeout=30, headers=_gh_headers(token), follow_redirects=True) as client:
        resp = await client.get(f"{_GH_BASE}/repos/{repo}/actions/jobs/{job_id}/logs")
        if resp.status_code == 404:
            return {"logs": ""}
        if resp.status_code != 200:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"GitHub logs fetch failed: {resp.text}")
    return {"logs": resp.text}


@router.get("/{key}")
@limiter.limit("60/minute")
async def get_var(
    request: Request,
    key: str,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    ip = request.client.host if request.client else None
    var = await get_env_var(session, key)
    if not var:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Key not found")
    await create_audit_log(session, action="env_var_revealed", actor_id=str(admin.id), actor_name=admin.username, target_name=key, detail="value revealed", ip_address=ip)
    return {"key": var.key, "value": _dec(var.value), "updated_at": var.updated_at.isoformat() if var.updated_at else None}


@router.put("/{key}")
async def upsert_var(
    request: Request,
    key: str,
    body: EnvVarBody,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    ip = request.client.host if request.client else None
    existing = await get_env_var(session, key)
    var = await set_env_var(session, key, _enc(body.value))
    if _DEV_DOTENV_PATH:
        _write_dotenv(_DEV_DOTENV_PATH, {key: body.value})
    else:
        token, repo = await _get_github_config(session)
        await _push_secret_to_github(key, body.value, token, repo)
    await create_audit_log(session, action="env_var_set", actor_id=str(admin.id), actor_name=admin.username, target_name=key, detail="updated" if existing else "created", ip_address=ip)
    return {"key": var.key, "updated_at": var.updated_at.isoformat() if var.updated_at else None}


@router.delete("/{key}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_var(
    request: Request,
    key: str,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    ip = request.client.host if request.client else None
    deleted = await delete_env_var(session, key)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Key not found")
    if _DEV_DOTENV_PATH:
        _remove_from_dotenv(_DEV_DOTENV_PATH, key)
    else:
        token, repo = await _get_github_config(session)
        await _delete_secret_from_github(key, token, repo)
    await create_audit_log(session, action="env_var_deleted", actor_id=str(admin.id), actor_name=admin.username, target_name=key, detail="removed from store", ip_address=ip)


# ── Deploy endpoint ───────────────────────────────────────────────────────────

@router.post("/deploy")
async def deploy(
    request: Request,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    vars_ = await list_env_vars(session)
    app_vars = [v for v in vars_ if v.key not in _RESERVED_KEYS]
    if not app_vars:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No environment variables to deploy")

    ip = request.client.host if request.client else None

    if _DEV_DOTENV_PATH:
        plain_vars = {v.key: _dec(v.value) for v in app_vars}
        try:
            _write_dotenv(_DEV_DOTENV_PATH, plain_vars)
        except OSError as exc:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to write .env: {exc}") from exc
        await create_audit_log(session, action="env_deployed", actor_id=str(admin.id), actor_name=admin.username, detail=f"{len(app_vars)} vars written to {_DEV_DOTENV_PATH}", ip_address=ip)
        return {"ok": True}

    token, repo = await _get_github_config(session)
    if not token or not repo:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="GitHub token or repo not configured")

    async with httpx.AsyncClient(timeout=30, headers=_gh_headers(token)) as client:
        dispatch_resp = await client.post(
            f"{_GH_BASE}/repos/{repo}/actions/workflows/{_WORKFLOW_FILE}/dispatches",
            json={"ref": "main"},
        )
        if dispatch_resp.status_code != 204:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Workflow dispatch failed: {dispatch_resp.text}")

    await create_audit_log(session, action="env_deployed", actor_id=str(admin.id), actor_name=admin.username, detail="workflow_dispatch triggered", ip_address=ip)
    return {"ok": True}
