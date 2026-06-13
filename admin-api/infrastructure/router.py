import asyncio
import json
import os
import re
import time

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request

from auth.security import get_current_user
from health.router import _postgres_check, _redis_check

router = APIRouter(prefix="/infrastructure", tags=["Infrastructure"])

_DEFAULT_URL = os.getenv("MEDIA_API_URL", "http://media-api:9374")
_API_KEY = os.getenv("MEDIA_API_KEY", "")
_CONTAINER_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_.\-]{0,127}$")


async def _get_server_url(request: Request, server: str) -> str:
    redis = request.app.state.redis
    snapshot_exists = False
    try:
        raw = await redis.lindex(f"worker-monitor:metrics:{server}", 0)
        if raw:
            snapshot_exists = True
            data = json.loads(raw)
            url = data.get("media_api_url")
            if url:
                return url
    except Exception:
        pass

    # Snapshot exists but predates media_api_url field (old worker-monitor) → use default
    if snapshot_exists or server == "main":
        return _DEFAULT_URL

    raise HTTPException(
        status_code=404,
        detail=f"No live data for server '{server}' — is the worker monitor running?",
    )


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


async def _execute_on(url: str, command: str) -> dict:
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{url}/execute",
            json={"command": command},
            headers={"X-API-Key": _API_KEY},
        )
    if resp.status_code == 403:
        raise HTTPException(status_code=403, detail="Media-API refused the request")
    return resp.json()


# ─── Per-server health check ──────────────────────────────────────────────────

@router.get("/servers/{server}/health")
async def server_health(
    server: str,
    request: Request,
    _user=Depends(get_current_user),
):
    """
    Full 8-service health check for any server.
    All workers share the same postgres/redis/n8n/minio/nginx/loki/promtail stack;
    only media-api differs per server (uses that server's URL).
    """
    media_url = await _get_server_url(request, server)
    n8n_port = os.getenv("N8N_PORT", "5678")

    results = await asyncio.gather(
        _http_check("n8n", f"http://n8n:{n8n_port}/healthz"),
        _postgres_check(),
        _redis_check(request),
        _http_check("MinIO", "http://minio:9000/minio/health/live"),
        _http_check("media-api", f"{media_url}/health", headers={"X-API-Key": _API_KEY}),
        _http_check("nginx", "http://nginx:6060/"),
        _http_check("Loki", "http://loki:3100/ready"),
        _http_check("Promtail", "http://promtail:9080/ready"),
    )
    return {"services": list(results)}


# ─── Container restart ────────────────────────────────────────────────────────

@router.post("/servers/{server}/restart/{container}")
async def restart_container(
    server: str,
    container: str,
    request: Request,
    _user=Depends(get_current_user),
):
    if not _CONTAINER_RE.fullmatch(container):
        raise HTTPException(status_code=400, detail="Invalid container name")

    url = await _get_server_url(request, server)

    try:
        result = await _execute_on(url, f"docker restart {container}")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return {"returnCode": result.get("returnCode"), "output": result.get("output", "")}
