import logging
import os

import asyncpg

log = logging.getLogger(__name__)

_CREATE_TABLE = """
CREATE TABLE IF NOT EXISTS admin_config (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"""


async def _conn():
    return await asyncpg.connect(
        host=os.getenv("POSTGRES_HOST", "postgres"),
        port=int(os.getenv("POSTGRES_PORT", "5432")),
        user=os.getenv("POSTGRES_USER", ""),
        password=os.getenv("POSTGRES_PASSWORD", ""),
        database=os.getenv("POSTGRES_DB", ""),
    )


async def pg_set(key: str, value: str) -> None:
    try:
        conn = await _conn()
        try:
            await conn.execute(_CREATE_TABLE)
            await conn.execute(
                "INSERT INTO admin_config (key, value) VALUES ($1, $2) "
                "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
                key, value,
            )
        finally:
            await conn.close()
    except Exception as exc:
        log.warning("pg_set(%s) failed (non-fatal): %s", key, exc)


async def pg_delete(key: str) -> None:
    try:
        conn = await _conn()
        try:
            await conn.execute(_CREATE_TABLE)
            await conn.execute("DELETE FROM admin_config WHERE key = $1", key)
        finally:
            await conn.close()
    except Exception as exc:
        log.warning("pg_delete(%s) failed (non-fatal): %s", key, exc)
