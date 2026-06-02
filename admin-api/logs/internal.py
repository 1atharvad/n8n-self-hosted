"""
Service-to-service audit ingestion endpoint.

Called by the `api/` FastAPI service (e.g. SQLAdmin hooks) which runs in a
separate container and has no access to our SQLite DB or JWT tokens. Auth is
via a shared INTERNAL_SECRET header instead of JWT.
"""
import os

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from db.crud import create_audit_log
from db.database import get_session

router = APIRouter()

_SECRET = os.getenv("INTERNAL_SECRET", "")


def _verify(secret: str = Header(alias="X-Internal-Secret")):
    if not _SECRET or secret != _SECRET:
        raise HTTPException(status_code=403, detail="Forbidden")


class AuditEventBody(BaseModel):
    action: str
    actor_name: str | None = None
    target_name: str | None = None
    detail: str | None = None
    ip_address: str | None = None


@router.post("/internal/audit", status_code=204, dependencies=[Depends(_verify)])
async def receive_audit_event(
    body: AuditEventBody,
    session: AsyncSession = Depends(get_session),
):
    await create_audit_log(
        session,
        action=body.action,
        actor_name=body.actor_name or "system",
        target_name=body.target_name,
        detail=body.detail,
        ip_address=body.ip_address,
    )
