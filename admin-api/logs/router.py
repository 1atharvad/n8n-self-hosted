import asyncio
import json
import time
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse, Response, StreamingResponse

from auth.security import get_current_user, decode_token
from db.models import User
from logs._loki import (
    LOKI_BASE,
    STATS_RANGE_CONFIG,
    TIME_RANGE_SECONDS,
    escape_logql,
    extract_max_ts_ns,
    loki_containers,
    loki_count,
    loki_series,
    ns_to_iso,
    parse_loki_response,
)

logs_router = APIRouter()


# ---------------------------------------------------------------------------
# Labels
# ---------------------------------------------------------------------------

@logs_router.get("/labels")
async def get_labels(request: Request, current_user: User = Depends(get_current_user)):
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            resp = await client.get(f"{LOKI_BASE}/loki/api/v1/label/container/values")
            resp.raise_for_status()
            loki_names: list[str] = resp.json().get("data", [])
        except httpx.HTTPError:
            loki_names = []

    monitor_names: set[str] = set()
    try:
        keys = await request.app.state.redis.keys("worker-monitor:metrics:*")
        for key in keys:
            raw = await request.app.state.redis.lindex(key, 0)
            if raw:
                snapshot = json.loads(raw)
                monitor_names.update(snapshot.get("containers", []))
                monitor_names.update(snapshot.get("container_cpu", {}).keys())
    except Exception:
        pass

    labels: list[str] = sorted(set(loki_names) | monitor_names)
    if current_user.allowed_containers is not None:
        allowed = set(current_user.allowed_containers)
        labels = [l for l in labels if l in allowed]

    return JSONResponse({"labels": labels})


# ---------------------------------------------------------------------------
# Query & Stream
# ---------------------------------------------------------------------------

@logs_router.get("/query")
async def query_logs(
    containers: Optional[str] = Query(default=None, description="Comma-separated container names"),
    search: Optional[str] = Query(default=None),
    level: Optional[str] = Query(default=None),
    range: str = Query(default="1h"),
    limit: int = Query(default=500, le=5000),
    current_user: User = Depends(get_current_user),
):
    seconds = TIME_RANGE_SECONDS.get(range, TIME_RANGE_SECONDS["1h"])
    now_ns = int(time.time() * 1e9)
    start_ns = now_ns - int(seconds * 1e9)

    container_list = [c.strip() for c in containers.split(",") if c.strip()] if containers else []
    if current_user.allowed_containers is not None:
        allowed = set(current_user.allowed_containers)
        container_list = [c for c in container_list if c in allowed] if container_list else list(current_user.allowed_containers)

    selector = f'{{container=~"{"|".join(container_list)}"}}' if container_list else '{container=~".+"}'
    pipeline = ""
    if search:
        pipeline += f' |= "{escape_logql(search)}"'
    if level and level != "all":
        pipeline += f' | level="{escape_logql(level.lower())}"'

    async with httpx.AsyncClient(timeout=30) as client:
        try:
            resp = await client.get(
                f"{LOKI_BASE}/loki/api/v1/query_range",
                params={"query": selector + pipeline, "start": str(start_ns), "end": str(now_ns), "limit": str(limit), "direction": "forward"},
            )
            resp.raise_for_status()
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"Loki query failed: {e}")

    entries = parse_loki_response(resp.json())
    return JSONResponse({"logs": entries, "count": len(entries)})


@logs_router.get("/stream")
async def stream_logs(
    request: Request,
    containers: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    level: Optional[str] = Query(default=None),
    since_ns: Optional[int] = Query(default=None),
    token: str = Query(...),
):
    """SSE endpoint — streams new log entries as they arrive. Token passed as query param."""
    try:
        payload = decode_token(token)
    except HTTPException:
        return Response(status_code=401)

    allowed_containers = payload.get("allowed_containers")
    container_list = [c.strip() for c in containers.split(",") if c.strip()] if containers else []
    if allowed_containers is not None:
        allowed = set(allowed_containers)
        if not allowed:
            return Response(status_code=403)
        container_list = [c for c in container_list if c in allowed] if container_list else list(allowed_containers)

    selector = '{container=~"' + "|".join(container_list) + '"}' if container_list else '{container=~".+"}'
    pipeline = ""
    if search:
        pipeline += f' |= "{escape_logql(search)}"'
    if level and level != "all":
        pipeline += f' | level="{escape_logql(level.lower())}"'

    logql = selector + pipeline
    start_ns = since_ns if since_ns else (int(time.time() * 1e9) - 2_000_000_000)

    async def event_stream():
        nonlocal start_ns
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                while True:
                    if await request.is_disconnected():
                        break
                    now_ns = int(time.time() * 1e9)
                    try:
                        resp = await client.get(
                            f"{LOKI_BASE}/loki/api/v1/query_range",
                            params={"query": logql, "start": str(start_ns), "end": str(now_ns), "limit": "100", "direction": "forward"},
                        )
                        if resp.status_code == 200:
                            raw_data = resp.json()
                            entries = parse_loki_response(raw_data)
                            for entry in entries:
                                yield f"data: {json.dumps(entry)}\n\n"
                            if entries:
                                max_ns = extract_max_ts_ns(raw_data)
                                start_ns = (max_ns + 1) if max_ns is not None else now_ns
                            else:
                                start_ns = now_ns
                    except Exception:
                        pass
                    yield ": heartbeat\n\n"
                    await asyncio.sleep(2)
        except asyncio.CancelledError:
            pass

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

@logs_router.get("/stats")
async def get_stats(
    time_range: str = Query(default="1d", alias="range"),
    current_user: User = Depends(get_current_user),
):
    cfg = STATS_RANGE_CONFIG.get(time_range, STATS_RANGE_CONFIG["1d"])
    now_s = int(time.time())
    now_ns = now_s * 10 ** 9
    start_ns = now_ns - int(cfg["seconds"] * 1e9)

    if current_user.allowed_containers is not None:
        allowed = current_user.allowed_containers
        if not allowed:
            return JSONResponse({"containers": [], "summary": {"total": 0, "errors": 0, "warnings": 0}, "timeseries": []})
        base = f'{{container=~"{"|".join(allowed)}"}}'
    else:
        base = '{container=~".+"}'

    err_filter  = ' |~ "(?i)(^|[\\\\s:])error|critical"'
    warn_filter = ' |~ "(?i)(^|[\\\\s:])warn"'

    async with httpx.AsyncClient(timeout=30) as client:
        results = await asyncio.gather(
            loki_containers(client),
            loki_count(client, base, cfg["loki_range"], now_s),
            loki_count(client, base + err_filter, cfg["loki_range"], now_s),
            loki_count(client, base + warn_filter, cfg["loki_range"], now_s),
            loki_series(client, base, now_ns, start_ns, cfg["window"], cfg["step"]),
            loki_series(client, base + err_filter, now_ns, start_ns, cfg["window"], cfg["step"]),
            loki_series(client, base + warn_filter, now_ns, start_ns, cfg["window"], cfg["step"]),
            return_exceptions=True,
        )

    def _safe(v, default):
        return default if isinstance(v, Exception) else v

    containers   = _safe(results[0], [])
    total        = _safe(results[1], 0)
    errors       = _safe(results[2], 0)
    warnings     = _safe(results[3], 0)
    total_series = _safe(results[4], {})
    error_series = _safe(results[5], {})
    warn_series  = _safe(results[6], {})

    if current_user.allowed_containers is not None:
        containers = [c for c in containers if c in set(current_user.allowed_containers)]

    step_s = cfg["step"]
    start_s = now_s - cfg["seconds"]
    all_times = [float(start_s + i * step_s) for i in range(cfg["seconds"] // step_s + 1)]

    def _nearest(series: dict, t: float) -> int:
        if t in series:
            return series[t]
        half = step_s / 2
        for k, v in series.items():
            if abs(k - t) <= half:
                return v
        return 0

    timeseries = [
        {"time": ns_to_iso(str(int(t * 1e9))), "total": _nearest(total_series, t), "error": _nearest(error_series, t), "warning": _nearest(warn_series, t)}
        for t in all_times
    ]

    return JSONResponse({"containers": containers, "summary": {"total": total, "errors": errors, "warnings": warnings}, "timeseries": timeseries})


# ---------------------------------------------------------------------------
# Worker monitor
# ---------------------------------------------------------------------------

@logs_router.get("/worker-monitor-metrics")
async def get_worker_monitor_metrics(request: Request, current_user: User = Depends(get_current_user)):
    try:
        keys = await request.app.state.redis.keys("worker-monitor:metrics:*")
    except Exception:
        return JSONResponse({"servers": {}})

    servers = {}
    for key in keys:
        hostname = key.split("worker-monitor:metrics:", 1)[1]
        try:
            raw = await request.app.state.redis.lrange(key, 0, 199)
        except Exception:
            continue
        points = []
        for item in raw:
            try:
                points.append(json.loads(item))
            except Exception:
                pass
        points.reverse()
        servers[hostname] = points

    return JSONResponse({"servers": servers})


