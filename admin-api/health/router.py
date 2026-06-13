import asyncio
import os
import time

import asyncpg
import httpx
from fastapi import APIRouter, Depends, Request

from auth.security import get_current_user

router = APIRouter(prefix="/health", tags=["Health"])

_N8N_PORT = os.getenv("N8N_PORT", "5678")
_MEDIA_API_URL = os.getenv("MEDIA_API_URL", "http://media-api:9374")
_MEDIA_API_KEY = os.getenv("MEDIA_API_KEY", "")


async def _http_check(name: str, url: str, headers: dict | None = None) -> dict:
    start = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(url, headers=headers or {})
        latency = round((time.monotonic() - start) * 1000)
        ok = resp.status_code < 500
        return {"name": name, "status": "up" if ok else "down", "latency_ms": latency, "message": f"HTTP {resp.status_code}"}
    except Exception as exc:
        latency = round((time.monotonic() - start) * 1000)
        return {"name": name, "status": "down", "latency_ms": latency, "message": str(exc)[:120]}


async def _redis_check(request: Request) -> dict:
    start = time.monotonic()
    try:
        await asyncio.wait_for(request.app.state.redis.ping(), timeout=3.0)
        latency = round((time.monotonic() - start) * 1000)
        return {"name": "Redis", "status": "up", "latency_ms": latency, "message": "PONG"}
    except Exception as exc:
        latency = round((time.monotonic() - start) * 1000)
        return {"name": "Redis", "status": "down", "latency_ms": latency, "message": str(exc)[:120]}


async def _postgres_check() -> dict:
    start = time.monotonic()
    try:
        conn = await asyncio.wait_for(
            asyncpg.connect(
                host=os.getenv("POSTGRES_HOST", "postgres"),
                port=int(os.getenv("POSTGRES_PORT", "5432")),
                user=os.getenv("POSTGRES_USER", ""),
                password=os.getenv("POSTGRES_PASSWORD", ""),
                database=os.getenv("POSTGRES_DB", ""),
            ),
            timeout=3.0,
        )
        await conn.execute("SELECT 1")
        await conn.close()
        latency = round((time.monotonic() - start) * 1000)
        return {"name": "PostgreSQL", "status": "up", "latency_ms": latency, "message": "OK"}
    except Exception as exc:
        latency = round((time.monotonic() - start) * 1000)
        return {"name": "PostgreSQL", "status": "down", "latency_ms": latency, "message": str(exc)[:120]}


@router.get("/services")
async def service_health(request: Request, _user=Depends(get_current_user)):
    results = await asyncio.gather(
        _http_check("n8n", f"http://n8n:{_N8N_PORT}/healthz"),
        _postgres_check(),
        _redis_check(request),
        _http_check("MinIO", "http://minio:9000/minio/health/live"),
        _http_check("media-api", f"{_MEDIA_API_URL}/health", headers={"X-API-Key": _MEDIA_API_KEY}),
        _http_check("nginx", "http://nginx:6060/"),
        _http_check("Loki", "http://loki:3100/ready"),
        _http_check("Promtail", "http://promtail:9080/ready"),
    )
    return {"services": list(results)}
