import os
import re

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from auth.security import get_current_user
from db.database import get_session
from env.router import _get_github_config

router = APIRouter(prefix="/backups", tags=["Backups"])

_SHA_RE = re.compile(r"^[0-9a-fA-F]{7,40}$")

_MEDIA_API_URL = os.getenv("MEDIA_API_URL", "http://media-api:9374")
_MEDIA_API_KEY = os.getenv("MEDIA_API_KEY", "")


async def _execute(command: str | None = None, script: str | None = None) -> dict:
    payload: dict = {}
    if command is not None:
        payload["command"] = command
    if script is not None:
        payload["script"] = script
    async with httpx.AsyncClient(timeout=300) as client:
        resp = await client.post(
            f"{_MEDIA_API_URL}/execute",
            json=payload,
            headers={"X-API-Key": _MEDIA_API_KEY},
        )
    if resp.status_code == 403:
        raise HTTPException(status_code=403, detail=resp.json().get("detail", "Forbidden"))
    return resp.json()


@router.post("")
async def backup_workflows(
    _user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    token, _ = await _get_github_config(session)
    token_arg = f"--token={token}" if token else ""
    return await _execute(command=f"/sh_files/backup_n8n_workflows.sh --force --commit {token_arg}".strip())


@router.get("")
async def list_backups(_user=Depends(get_current_user)):
    result = await _execute(
        script='git -C /workspace log --format="%H|%s|%ai" --grep="^Backup:" -- n8n-workflows/'
    )
    backups = []
    if result.get("returnCode") == 0:
        for line in result.get("output", "").splitlines():
            parts = line.split("|", 2)
            if len(parts) == 3:
                sha, message, date = parts
                backups.append({"sha": sha.strip(), "message": message.strip(), "date": date.strip()})
    return {"backups": backups}


@router.get("/{sha}/details")
async def backup_details(sha: str, _user=Depends(get_current_user)):
    if not _SHA_RE.fullmatch(sha):
        raise HTTPException(status_code=400, detail="Invalid commit SHA")
    result = await _execute(script=f"""
manifest=$(git -C /workspace show {sha}:n8n-workflows/manifest.json 2>/dev/null)
if [ -n "$manifest" ]; then
  echo "$manifest" | jq -r '.workflows[] | [.name, (.active | tostring), (.isArchived // false | tostring)] | @tsv'
else
  git -C /workspace ls-tree -r --name-only {sha} -- n8n-workflows/workflows/ 2>/dev/null | while read -r f; do
    git -C /workspace show {sha}:"$f" 2>/dev/null | jq -r '[.name // "Unknown", (.active // false | tostring), "false"] | @tsv' 2>/dev/null || true
  done
fi
""")
    workflows = []
    if result.get("returnCode") == 0:
        for line in result.get("output", "").splitlines():
            parts = line.split("\t")
            if len(parts) >= 2:
                workflows.append({
                    "name": parts[0],
                    "active": parts[1] == "true",
                    "archived": parts[2] == "true" if len(parts) > 2 else False,
                })
    return {"workflows": workflows, "count": len(workflows)}
