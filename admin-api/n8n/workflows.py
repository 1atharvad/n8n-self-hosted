from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from db.crud import create_audit_log
from db.database import get_session
from n8n._client import _n8n
from n8n._db import _pg, _personal_project_id
from n8n.schemas import AssignFolderBody

router = APIRouter()


@router.get("/workflows")
async def get_workflows():
    cutoff_24h = datetime.now(timezone.utc) - timedelta(hours=24)
    conn = await _pg()
    try:
        rows = await conn.fetch(
            """
            WITH last_exec AS (
                SELECT DISTINCT ON ("workflowId")
                       "workflowId",
                       status,
                       "startedAt",
                       EXTRACT(EPOCH FROM ("stoppedAt" - "startedAt")) * 1000 AS duration_ms
                FROM execution_entity
                WHERE "deletedAt" IS NULL
                ORDER BY "workflowId", "startedAt" DESC NULLS LAST
            ),
            stats24h AS (
                SELECT "workflowId",
                       COUNT(*) FILTER (WHERE status NOT IN ('running', 'waiting')) AS runs24h,
                       COUNT(*) FILTER (WHERE status IN ('error', 'crashed'))       AS errors24h
                FROM execution_entity
                WHERE "startedAt" >= $1 AND "deletedAt" IS NULL
                GROUP BY "workflowId"
            ),
            all_stats AS (
                SELECT "workflowId",
                       COUNT(*)                                                 AS total_runs,
                       COUNT(*) FILTER (WHERE status = 'success')              AS successes,
                       COUNT(*) FILTER (WHERE status IN ('error', 'crashed'))  AS errors
                FROM execution_entity
                WHERE "deletedAt" IS NULL
                GROUP BY "workflowId"
            )
            -- w.id is uuid; execution_entity.workflowId is varchar — cast required for joins
            SELECT w.id::text AS id, w.name, w.active, w."parentFolderId", w."updatedAt",
                   f.name        AS "folderName",
                   COALESCE(a.total_runs, 0)  AS "totalRuns",
                   COALESCE(a.successes, 0)   AS successes,
                   COALESCE(a.errors, 0)      AS errors,
                   COALESCE(s.runs24h, 0)     AS "runs24h",
                   COALESCE(s.errors24h, 0)   AS "errors24h",
                   le.status                  AS "lastStatus",
                   le."startedAt"             AS "lastRunAt",
                   le.duration_ms             AS "lastDurationMs"
            FROM workflow_entity w
            LEFT JOIN folder     f  ON f.id  = w."parentFolderId"
            LEFT JOIN last_exec  le ON le."workflowId" = w.id::text
            LEFT JOIN stats24h   s  ON s."workflowId"  = w.id::text
            LEFT JOIN all_stats  a  ON a."workflowId"  = w.id::text
            WHERE w."isArchived" = false
            ORDER BY w."updatedAt" DESC NULLS LAST
            """,
            cutoff_24h,
        )
    finally:
        await conn.close()

    result = []
    for row in rows:
        result.append({
            "id": row["id"],
            "name": row["name"],
            "active": row["active"],
            "folderId": row["parentFolderId"],
            "folderName": row["folderName"],
            "updatedAt": row["updatedAt"].isoformat() if row["updatedAt"] else None,
            "totalRuns": row["totalRuns"],
            "successes": row["successes"],
            "errors": row["errors"],
            "runs24h": row["runs24h"],
            "errors24h": row["errors24h"],
            "lastStatus": row["lastStatus"],
            "lastRunAt": row["lastRunAt"].isoformat() if row["lastRunAt"] else None,
            "lastDurationMs": int(row["lastDurationMs"]) if row["lastDurationMs"] is not None else None,
        })

    return JSONResponse({"available": True, "workflows": result})


@router.get("/executions/daily")
async def get_executions_daily(ids: str = "", days: int = 14):
    days = max(1, min(days, 90))
    granularity = "hour" if days <= 1 else "day"
    workflow_ids = [i.strip() for i in ids.split(",") if i.strip()]
    if not workflow_ids:
        return JSONResponse({"data": [], "granularity": granularity})
    conn = await _pg()
    try:
        rows = await conn.fetch(
            f"""
            SELECT e."workflowId",
                   w.name AS "workflowName",
                   DATE_TRUNC('{granularity}', e."startedAt" AT TIME ZONE 'UTC') AS bucket,
                   COUNT(*) AS runs
            FROM execution_entity e
            JOIN workflow_entity w ON w.id::text = e."workflowId"
            WHERE e."workflowId" = ANY($1)
              AND e."startedAt" >= NOW() - INTERVAL '{days} days'
              AND e."deletedAt" IS NULL
            GROUP BY e."workflowId", w.name, bucket
            ORDER BY bucket ASC
            """,
            workflow_ids,
        )
    finally:
        await conn.close()
    return JSONResponse({
        "granularity": granularity,
        "data": [
            {
                "workflowId": row["workflowId"],
                "workflowName": row["workflowName"],
                "bucket": row["bucket"].isoformat(),
                "runs": row["runs"],
            }
            for row in rows
        ],
    })


@router.get("/workflows/{workflow_id}/executions")
async def get_workflow_executions(workflow_id: str):
    conn = await _pg()
    try:
        rows = await conn.fetch(
            """
            SELECT "startedAt", "durationMs", status FROM (
                SELECT "startedAt",
                       EXTRACT(EPOCH FROM ("stoppedAt" - "startedAt")) * 1000 AS "durationMs",
                       status
                FROM execution_entity
                WHERE "workflowId" = $1
                  AND "deletedAt" IS NULL
                  AND "stoppedAt" IS NOT NULL
                ORDER BY "startedAt" DESC
                LIMIT 50
            ) sub
            ORDER BY "startedAt" ASC
            """,
            workflow_id,
        )
    finally:
        await conn.close()
    return JSONResponse({
        "executions": [
            {"startedAt": row["startedAt"].isoformat(), "durationMs": int(row["durationMs"]), "status": row["status"]}
            for row in rows
        ],
    })


@router.put("/workflows/{workflow_id}/folder")
async def assign_workflow_folder(workflow_id: str, body: AssignFolderBody, session: AsyncSession = Depends(get_session)):
    conn = await _pg()
    try:
        project_id = await _personal_project_id(conn)
        wf = await conn.fetchrow('SELECT name FROM workflow_entity WHERE id::text = $1', workflow_id)
        folder = await conn.fetchrow('SELECT name FROM folder WHERE id = $1', body.folder_id)
    finally:
        await conn.close()
    await _n8n("PUT", f"/workflows/{workflow_id}/transfer", {
        "destinationProjectId": project_id,
        "destinationParentFolderId": body.folder_id,
    })
    wf_name = wf["name"] if wf else workflow_id
    folder_name = folder["name"] if folder else body.folder_id
    await create_audit_log(session, action="workflow_moved", target_name=wf_name, detail=f"→{folder_name}")
    return JSONResponse({"ok": True})


@router.delete("/workflows/{workflow_id}/folder")
async def remove_workflow_from_folder(workflow_id: str, session: AsyncSession = Depends(get_session)):
    conn = await _pg()
    try:
        project_id = await _personal_project_id(conn)
        wf = await conn.fetchrow('SELECT name FROM workflow_entity WHERE id::text = $1', workflow_id)
    finally:
        await conn.close()
    # Omitting destinationParentFolderId is intentional — n8n moves the workflow to the project root
    await _n8n("PUT", f"/workflows/{workflow_id}/transfer", {"destinationProjectId": project_id})
    wf_name = wf["name"] if wf else workflow_id
    await create_audit_log(session, action="workflow_unassigned", target_name=wf_name)
    return JSONResponse({"ok": True})
