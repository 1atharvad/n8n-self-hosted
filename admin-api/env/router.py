"""
Environment variable management — CRUD backed by SQLite + GitHub Secrets sync.

SQLite is the source of truth. On deploy, all vars are encrypted with the
repo's libsodium public key and pushed as GitHub Secrets, then
workflow_dispatch is triggered on deploy.yml.

Values are stored AES-encrypted (Fernet) at rest, keyed from JWT_SECRET.
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
from db.crud import create_audit_log, delete_env_var, get_env_var, list_env_vars, set_env_var
from db.database import get_session
from db.models import User
from limiter import limiter

router = APIRouter()

# ── At-rest encryption (Fernet / AES-128-CBC+HMAC) ───────────────────────────
# Derives a 256-bit key from JWT_SECRET so no extra env var is needed.
# Changing JWT_SECRET will invalidate stored values — re-enter them if rotated.
_jwt_secret = os.getenv("JWT_SECRET", "changeme-set-JWT_SECRET-in-env")
_fernet = Fernet(base64.urlsafe_b64encode(hashlib.sha256(_jwt_secret.encode()).digest()))


def _enc(value: str) -> str:
    return _fernet.encrypt(value.encode()).decode()


def _dec(value: str) -> str:
    try:
        return _fernet.decrypt(value.encode()).decode()
    except InvalidToken:
        return value  # legacy plaintext value — returned as-is


_GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")
_GITHUB_REPO = os.getenv("GITHUB_REPO", "")
_GITHUB_ENV = os.getenv("GITHUB_ENV", "production")
_WORKFLOW_FILE = os.getenv("GITHUB_WORKFLOW_FILE", "deploy.yml")
_GH_BASE = "https://api.github.com"
_DEV_DOTENV_PATH = os.getenv("DEV_DOTENV_PATH", "")


def _gh_headers() -> dict:
    return {
        "Authorization": f"Bearer {_GITHUB_TOKEN}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


def _quote_dotenv(value: str) -> str:
    """Wrap a value in double quotes, escaping internal backslashes and double-quotes."""
    escaped = value.replace("\\", "\\\\").replace('"', '\\"')
    return f'"{escaped}"'


def _write_dotenv(path: str, new_vars: dict) -> None:
    """Merge new_vars into the .env file at path, preserving unmanaged keys and comments."""
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
    """Remove a single key from the .env file if present."""
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
    """Encrypt a secret value using the repo's libsodium public key (sealed box)."""
    raw_key = base64.b64decode(public_key_b64)
    sealed = SealedBox(PublicKey(raw_key))
    encrypted = sealed.encrypt(value.encode(), encoder=RawEncoder)
    return base64.b64encode(encrypted).decode()


# ── Schemas ───────────────────────────────────────────────────────────────────

class EnvVarBody(BaseModel):
    value: str


class EnvVarOut(BaseModel):
    key: str
    value: str
    updated_at: Optional[str]


# ── CRUD endpoints ────────────────────────────────────────────────────────────

@router.get("/")
async def list_vars(
    _admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    vars_ = await list_env_vars(session)
    return {"vars": [{"key": v.key, "updated_at": v.updated_at.isoformat() if v.updated_at else None} for v in vars_]}


# ── GitHub Actions runs endpoint ─────────────────────────────────────────────

@router.get("/runs")
@limiter.limit("30/minute")
async def get_workflow_runs(
    request: Request,
    _admin: User = Depends(require_admin),
    per_page: int = 10,
):
    if not _GITHUB_TOKEN or not _GITHUB_REPO:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="GITHUB_TOKEN or GITHUB_REPO not configured")
    async with httpx.AsyncClient(timeout=15, headers=_gh_headers()) as client:
        resp = await client.get(
            f"{_GH_BASE}/repos/{_GITHUB_REPO}/actions/workflows/{_WORKFLOW_FILE}/runs",
            params={"per_page": min(per_page, 25)},
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"GitHub API error: {resp.text}")
    data = resp.json()
    runs = [
        {
            "id": r["id"],
            "run_number": r["run_number"],
            "status": r["status"],
            "conclusion": r["conclusion"],
            "event": r["event"],
            "created_at": r["created_at"],
            "updated_at": r["updated_at"],
            "html_url": r["html_url"],
            "actor": r["actor"]["login"] if r.get("actor") else None,
        }
        for r in data.get("workflow_runs", [])
    ]
    return {"runs": runs}


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


async def _push_secret_to_github(key: str, value: str) -> None:
    """Encrypt and upsert a single secret to the GitHub environment. No-op in dev mode."""
    if _DEV_DOTENV_PATH or not _GITHUB_TOKEN or not _GITHUB_REPO:
        return
    async with httpx.AsyncClient(timeout=30, headers=_gh_headers()) as client:
        pk_resp = await client.get(
            f"{_GH_BASE}/repos/{_GITHUB_REPO}/environments/{_GITHUB_ENV}/secrets/public-key"
        )
        if pk_resp.status_code != 200:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"GitHub public key fetch failed: {pk_resp.text}")
        pk_data = pk_resp.json()
        encrypted = _encrypt_secret(pk_data["key"], value)
        resp = await client.put(
            f"{_GH_BASE}/repos/{_GITHUB_REPO}/environments/{_GITHUB_ENV}/secrets/{key}",
            json={"encrypted_value": encrypted, "key_id": pk_data["key_id"]},
        )
        if resp.status_code not in (201, 204):
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"GitHub secret push failed: {resp.text}")


async def _delete_secret_from_github(key: str) -> None:
    """Delete a secret from the GitHub environment. No-op in dev mode or if not configured."""
    if _DEV_DOTENV_PATH or not _GITHUB_TOKEN or not _GITHUB_REPO:
        return
    async with httpx.AsyncClient(timeout=30, headers=_gh_headers()) as client:
        resp = await client.delete(
            f"{_GH_BASE}/repos/{_GITHUB_REPO}/environments/{_GITHUB_ENV}/secrets/{key}"
        )
        if resp.status_code not in (204, 404):
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"GitHub secret delete failed: {resp.text}")


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
        await _push_secret_to_github(key, body.value)
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
        await _delete_secret_from_github(key)
    await create_audit_log(session, action="env_var_deleted", actor_id=str(admin.id), actor_name=admin.username, target_name=key, detail="removed from store", ip_address=ip)


# ── Deploy endpoint ───────────────────────────────────────────────────────────

@router.post("/deploy")
async def deploy(
    request: Request,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    vars_ = await list_env_vars(session)
    if not vars_:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No environment variables to deploy")

    ip = request.client.host if request.client else None

    # Dev mode: write all vars to the mounted .env file and return
    if _DEV_DOTENV_PATH:
        plain_vars = {v.key: _dec(v.value) for v in vars_}
        try:
            _write_dotenv(_DEV_DOTENV_PATH, plain_vars)
        except OSError as exc:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to write .env: {exc}") from exc
        await create_audit_log(
            session,
            action="env_deployed",
            actor_id=str(admin.id),
            actor_name=admin.username,
            detail=f"{len(vars_)} vars written to {_DEV_DOTENV_PATH}",
            ip_address=ip,
        )
        return {"ok": True}

    if not _GITHUB_TOKEN or not _GITHUB_REPO:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="GITHUB_TOKEN or GITHUB_REPO not configured")

    async with httpx.AsyncClient(timeout=30, headers=_gh_headers()) as client:
        dispatch_resp = await client.post(
            f"{_GH_BASE}/repos/{_GITHUB_REPO}/actions/workflows/{_WORKFLOW_FILE}/dispatches",
            json={"ref": "main"},
        )
        if dispatch_resp.status_code != 204:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Workflow dispatch failed: {dispatch_resp.text}")

    await create_audit_log(
        session,
        action="env_deployed",
        actor_id=str(admin.id),
        actor_name=admin.username,
        detail="workflow_dispatch triggered",
        ip_address=ip,
    )
    return {"ok": True}
