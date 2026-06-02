from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from db.crud import create_audit_log
from db.database import get_session
from n8n._client import _n8n
from n8n._db import _pg, _personal_project_id
from n8n.schemas import FolderBody

router = APIRouter()


@router.get("/folders")
async def list_folders():
    conn = await _pg()
    try:
        project_id = await _personal_project_id(conn)
        rows = await conn.fetch(
            'SELECT id, name, "parentFolderId" FROM folder WHERE "projectId" = $1 ORDER BY name',
            project_id,
        )
    finally:
        await conn.close()
    return JSONResponse({
        "folders": [{"id": r["id"], "name": r["name"], "parentFolderId": r["parentFolderId"]} for r in rows],
    })


@router.post("/folders")
async def create_folder(body: FolderBody, session: AsyncSession = Depends(get_session)):
    conn = await _pg()
    try:
        project_id = await _personal_project_id(conn)
    finally:
        await conn.close()
    folder = await _n8n("POST", f"/projects/{project_id}/folders", {"name": body.name})
    await create_audit_log(session, action="folder_created", target_name=body.name)
    return JSONResponse({"id": folder["id"], "name": folder["name"]})


@router.patch("/folders/{folder_id}")
async def rename_folder(folder_id: str, body: FolderBody, session: AsyncSession = Depends(get_session)):
    conn = await _pg()
    try:
        project_id = await _personal_project_id(conn)
        old = await conn.fetchrow('SELECT name FROM folder WHERE id = $1', folder_id)
    finally:
        await conn.close()
    folder = await _n8n("PATCH", f"/projects/{project_id}/folders/{folder_id}", {"name": body.name})
    old_name = old["name"] if old else folder_id
    await create_audit_log(session, action="folder_renamed", target_name=body.name, detail=f"was: {old_name}")
    return JSONResponse({"id": folder["id"], "name": folder["name"]})


@router.delete("/folders/{folder_id}")
async def delete_folder(folder_id: str, session: AsyncSession = Depends(get_session)):
    conn = await _pg()
    try:
        project_id = await _personal_project_id(conn)
        # Fetch name before DELETE — postgres row won't exist after the n8n call
        row = await conn.fetchrow('SELECT name FROM folder WHERE id = $1', folder_id)
    finally:
        await conn.close()
    await _n8n("DELETE", f"/projects/{project_id}/folders/{folder_id}")
    folder_name = row["name"] if row else folder_id
    await create_audit_log(session, action="folder_deleted", target_name=folder_name)
    return JSONResponse({"ok": True})
