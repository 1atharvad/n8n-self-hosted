import os

import asyncpg

_DSN = (
    f"postgresql://{os.getenv('POSTGRES_USER')}:{os.getenv('POSTGRES_PASSWORD')}"
    f"@{os.getenv('POSTGRES_HOST', 'postgres')}:{os.getenv('POSTGRES_PORT', '5432')}"
    f"/{os.getenv('POSTGRES_DB')}"
)

_CREATE_TABLE = """
CREATE TABLE IF NOT EXISTS admin_config (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"""


async def _conn():
    return await asyncpg.connect(_DSN)


async def pg_set(key: str, value: str) -> None:
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


async def pg_delete(key: str) -> None:
    conn = await _conn()
    try:
        await conn.execute(_CREATE_TABLE)
        await conn.execute("DELETE FROM admin_config WHERE key = $1", key)
    finally:
        await conn.close()
