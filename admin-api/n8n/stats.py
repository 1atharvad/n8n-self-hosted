from datetime import datetime, timedelta, timezone

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from n8n._db import _pg, _personal_project_id

router = APIRouter()


@router.get("/running")
async def get_running():
    conn = await _pg()
    try:
        rows = await conn.fetch(
            """
            SELECT DISTINCT "workflowId"
            FROM execution_entity
            WHERE status IN ('running', 'waiting') AND "deletedAt" IS NULL
            """,
        )
    finally:
        await conn.close()
    return JSONResponse({"ids": [r["workflowId"] for r in rows]})


@router.get("/stats")
async def get_stats():
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    conn = await _pg()
    try:
        rows = await conn.fetch(
            """
            SELECT status, COUNT(*) AS cnt
            FROM execution_entity
            WHERE "startedAt" >= $1 AND "deletedAt" IS NULL
            GROUP BY status
            """,
            cutoff,
        )
    finally:
        await conn.close()

    counts: dict[str, int] = {r["status"]: r["cnt"] for r in rows}
    return JSONResponse({
        "available": True,
        "success": counts.get("success", 0),
        "error": counts.get("error", 0) + counts.get("crashed", 0),
        "running": counts.get("running", 0) + counts.get("waiting", 0),
        "total": sum(counts.values()),
    })


@router.get("/project")
async def get_project():
    conn = await _pg()
    try:
        project_id = await _personal_project_id(conn)
    finally:
        await conn.close()
    return JSONResponse({"id": project_id})
