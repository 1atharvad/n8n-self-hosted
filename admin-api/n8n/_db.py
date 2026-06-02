import os

import asyncpg
from fastapi import HTTPException

_POSTGRES_KWARGS = {
    "host": os.getenv("POSTGRES_HOST", "postgres"),
    "port": int(os.getenv("POSTGRES_PORT", "5432")),
    "user": os.getenv("POSTGRES_USER", ""),
    "password": os.getenv("POSTGRES_PASSWORD", ""),
    "database": os.getenv("POSTGRES_DB", ""),
}


async def _pg() -> asyncpg.Connection:
    return await asyncpg.connect(**_POSTGRES_KWARGS)


async def _personal_project_id(conn: asyncpg.Connection) -> str:
    row = await conn.fetchrow("SELECT id FROM project WHERE type = 'personal' LIMIT 1")
    if not row:
        raise HTTPException(status_code=503, detail="n8n personal project not found")
    return row["id"]
