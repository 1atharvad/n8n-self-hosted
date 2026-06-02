from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from auth.security import require_admin
from db.crud import list_audit_logs
from db.database import get_session
from db.models import User

router = APIRouter()


@router.get("/audit")
async def get_audit_log(
    limit: int = Query(default=100, le=500),
    _admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    logs, total, events_24h = await list_audit_logs(session, limit=limit)
    return JSONResponse({
        "total": total,
        "events_24h": events_24h,
        "logs": [
            {
                "id": log.id,
                "actor_name": log.actor_name,
                "action": log.action,
                "target_name": log.target_name,
                "detail": log.detail,
                "ip_address": log.ip_address,
                "created_at": log.created_at.isoformat() if log.created_at else None,
            }
            for log in logs
        ]
    })
