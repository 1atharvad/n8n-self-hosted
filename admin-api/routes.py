import asyncio
import datetime
import json
import time
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse, StreamingResponse, Response

from auth.security import get_current_user, decode_token
from db.models import User

router = APIRouter()

LOKI_BASE = "http://loki:3100"

TIME_RANGE_SECONDS = {
    "15m": 15 * 60,
    "1h":  60 * 60,
    "6h":  6 * 60 * 60,
    "24h": 24 * 60 * 60,
}

STATS_RANGE_CONFIG = {
    "1m":  {"seconds": 60,    "loki_range": "1m",  "step": 10,   "window": "10s"},
    "5m":  {"seconds": 300,   "loki_range": "5m",  "step": 30,   "window": "30s"},
    "15m": {"seconds": 900,   "loki_range": "15m", "step": 60,   "window": "1m"},
    "30m": {"seconds": 1800,  "loki_range": "30m", "step": 120,  "window": "2m"},
    "1h":  {"seconds": 3600,  "loki_range": "1h",  "step": 300,  "window": "5m"},
    "1d":  {"seconds": 86400, "loki_range": "24h", "step": 3600, "window": "1h"},
}


@router.get("/labels")
async def get_labels(request: Request, current_user: User = Depends(get_current_user)):
    """Return container names from Loki + running containers from worker-monitor metrics."""
    url = f"{LOKI_BASE}/loki/api/v1/label/container/values"
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            resp = await client.get(url)
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


@router.get("/query")
async def query_logs(
    containers: Optional[str] = Query(default=None, description="Comma-separated container names"),
    search: Optional[str] = Query(default=None),
    level: Optional[str] = Query(default=None),
    range: str = Query(default="1h"),
    limit: int = Query(default=500, le=5000),
    current_user: User = Depends(get_current_user),
):
    """
    Query logs from Loki and return a flat list of log entries.

    Builds a LogQL query from the provided filters and proxies the request
    to Loki's query_range endpoint. Results are restricted to the user's
    allowed_containers if set.
    """
    seconds = TIME_RANGE_SECONDS.get(range, TIME_RANGE_SECONDS["1h"])
    now_ns = int(time.time() * 1e9)
    start_ns = now_ns - int(seconds * 1e9)

    # Build container list from request, then enforce allowed_containers
    container_list = [c.strip() for c in containers.split(",") if c.strip()] if containers else []

    if current_user.allowed_containers is not None:
        allowed = set(current_user.allowed_containers)
        if container_list:
            container_list = [c for c in container_list if c in allowed]
        else:
            # No explicit filter means "all" — restrict to the user's allowlist
            container_list = list(current_user.allowed_containers)

    # Build LogQL selector
    if container_list:
        name_pattern = "|".join(container_list)
        selector = f'{{container=~"{name_pattern}"}}'
    else:
        selector = '{container=~".+"}'

    # Build pipeline stages
    pipeline = ""
    if search:
        pipeline += f' |= "{_escape_logql(search)}"'
    if level and level != "all":
        pipeline += f' | level="{_escape_logql(level.lower())}"'

    logql = selector + pipeline

    params = {
        "query": logql,
        "start": str(start_ns),
        "end": str(now_ns),
        "limit": str(limit),
        "direction": "forward",
    }

    async with httpx.AsyncClient(timeout=30) as client:
        try:
            resp = await client.get(
                f"{LOKI_BASE}/loki/api/v1/query_range",
                params=params,
            )
            resp.raise_for_status()
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"Loki query failed: {e}")

    data = resp.json()
    entries = _parse_loki_response(data)
    return JSONResponse({"logs": entries, "count": len(entries)})


@router.get("/stream")
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

    if container_list:
        selector = '{container=~"' + "|".join(container_list) + '"}'
    else:
        selector = '{container=~".+"}'

    pipeline = ""
    if search:
        pipeline += f' |= "{_escape_logql(search)}"'
    if level and level != "all":
        pipeline += f' | level="{_escape_logql(level.lower())}"'

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
                            params={
                                "query": logql,
                                "start": str(start_ns),
                                "end": str(now_ns),
                                "limit": "100",
                                "direction": "forward",
                            },
                        )
                        if resp.status_code == 200:
                            raw_data = resp.json()
                            entries = _parse_loki_response(raw_data)
                            for entry in entries:
                                yield f"data: {json.dumps(entry)}\n\n"
                            if entries:
                                max_ns = _extract_max_ts_ns(raw_data)
                                start_ns = (max_ns + 1) if max_ns is not None else now_ns
                            else:
                                # Keep a 5s lookback to cover Loki ingestion lag
                                start_ns = now_ns - 5_000_000_000
                    except Exception:
                        pass
                    yield ": heartbeat\n\n"
                    await asyncio.sleep(2)
        except asyncio.CancelledError:
            pass

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


def _escape_logql(s: str) -> str:
    """Escape a string for use inside a LogQL double-quoted literal."""
    return s.replace("\\", "\\\\").replace('"', '\\"')


def _extract_max_ts_ns(data: dict) -> int | None:
    """Return the highest nanosecond timestamp in a raw Loki query_range response."""
    max_ns: int | None = None
    for stream in data.get("data", {}).get("result", []):
        for ts_ns, _ in stream.get("values", []):
            ns = int(ts_ns)
            if max_ns is None or ns > max_ns:
                max_ns = ns
    return max_ns


def _parse_loki_response(data: dict) -> list[dict]:
    """Flatten Loki's stream result format into a list of log entry dicts."""
    entries: list[dict] = []
    results = data.get("data", {}).get("result", [])
    for stream in results:
        labels = stream.get("stream", {})
        container = (
            labels.get("container_name")
            or labels.get("container")
            or labels.get("service_name")
            or "unknown"
        )
        for ts_ns, line in stream.get("values", []):
            level = _extract_level(line, labels)
            entries.append({
                "ts": _ns_to_iso(ts_ns),
                "container": container,
                "level": level,
                "message": line,
            })

    entries.sort(key=lambda e: e["ts"])
    return entries


def _ns_to_iso(ts_ns: str) -> str:
    """Convert nanosecond Unix timestamp string to ISO 8601."""
    secs = int(ts_ns) / 1e9
    import datetime
    dt = datetime.datetime.fromtimestamp(secs, tz=datetime.timezone.utc)
    return dt.isoformat()


def _extract_level(line: str, labels: dict) -> str:
    """Best-effort log level extraction from labels or log line content."""
    for key in ("level", "severity", "log_level"):
        if key in labels:
            return labels[key]

    upper = line[:80].upper()
    for lvl in ("ERROR", "CRITICAL", "WARNING", "WARN", "INFO", "DEBUG"):
        if lvl in upper:
            return lvl.lower()

    return "info"


# ---------------------------------------------------------------------------
# Dashboard stats
# ---------------------------------------------------------------------------

@router.get("/stats")
async def get_stats(
    time_range: str = Query(default="1d", alias="range"),
    current_user: User = Depends(get_current_user),
):
    """Return log summary counts + time series for the dashboard."""
    cfg = STATS_RANGE_CONFIG.get(time_range, STATS_RANGE_CONFIG["1d"])
    now_s = int(time.time())
    now_ns = now_s * 10 ** 9
    start_ns = now_ns - int(cfg["seconds"] * 1e9)

    if current_user.allowed_containers is not None:
        allowed = current_user.allowed_containers
        if not allowed:
            return JSONResponse({
                "containers": [],
                "summary": {"total": 0, "errors": 0, "warnings": 0},
                "timeseries": [],
            })
        pattern = "|".join(allowed)
        base = f'{{container=~"{pattern}"}}'
    else:
        base = '{container=~".+"}'

    err_filter  = ' |~ "(?i)(^|[\\\\s:])error|critical"'
    warn_filter = ' |~ "(?i)(^|[\\\\s:])warn"'

    async with httpx.AsyncClient(timeout=30) as client:
        results = await asyncio.gather(
            _loki_containers(client),
            _loki_count(client, base, cfg["loki_range"], now_s),
            _loki_count(client, base + err_filter, cfg["loki_range"], now_s),
            _loki_count(client, base + warn_filter, cfg["loki_range"], now_s),
            _loki_series(client, base, now_ns, start_ns, cfg["window"], cfg["step"]),
            _loki_series(client, base + err_filter, now_ns, start_ns, cfg["window"], cfg["step"]),
            _loki_series(client, base + warn_filter, now_ns, start_ns, cfg["window"], cfg["step"]),
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
        allowed_set = set(current_user.allowed_containers)
        containers = [c for c in containers if c in allowed_set]

    step_s = cfg["step"]
    start_s = now_s - cfg["seconds"]
    num_points = cfg["seconds"] // step_s
    all_times = [float(start_s + i * step_s) for i in range(num_points + 1)]

    def _nearest(series: dict, t: float) -> int:
        if t in series:
            return series[t]
        # Loki may align timestamps slightly off; find nearest within half a step
        half = step_s / 2
        for k, v in series.items():
            if abs(k - t) <= half:
                return v
        return 0

    timeseries = [
        {
            "time": _ns_to_iso(str(int(t * 1e9))),
            "total": _nearest(total_series, t),
            "error": _nearest(error_series, t),
            "warning": _nearest(warn_series, t),
        }
        for t in all_times
    ]

    return JSONResponse({
        "containers": containers,
        "summary": {"total": total, "errors": errors, "warnings": warnings},
        "timeseries": timeseries,
    })


async def _loki_containers(client: httpx.AsyncClient) -> list[str]:
    now_ns = int(time.time() * 1e9)
    start_ns = now_ns - int(86400 * 1e9)  # look back 24 h for label discovery
    resp = await client.get(
        f"{LOKI_BASE}/loki/api/v1/label/container/values",
        params={"start": str(start_ns), "end": str(now_ns)},
    )
    resp.raise_for_status()
    return sorted(resp.json().get("data", []))


async def _loki_count(client: httpx.AsyncClient, selector: str, duration: str, now_s: int) -> int:
    query = f"sum(count_over_time({selector}[{duration}]))"
    resp = await client.get(
        f"{LOKI_BASE}/loki/api/v1/query",
        params={"query": query, "time": str(now_s)},
    )
    resp.raise_for_status()
    results = resp.json().get("data", {}).get("result", [])
    if not results:
        return 0
    return int(float(results[0]["value"][1]))


@router.get("/worker-monitor-metrics")
async def get_worker_monitor_metrics(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """Return the last 200 metric snapshots per server, keyed by hostname."""
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
        points.reverse()  # LPUSH stores newest first; reverse to chronological
        servers[hostname] = points

    return JSONResponse({"servers": servers})


async def _loki_series(
    client: httpx.AsyncClient,
    selector: str,
    end_ns: int,
    start_ns: int,
    window: str = "1h",
    step: int = 3600,
) -> dict:
    query = f"sum(count_over_time({selector}[{window}]))"
    resp = await client.get(
        f"{LOKI_BASE}/loki/api/v1/query_range",
        params={"query": query, "start": str(start_ns), "end": str(end_ns), "step": str(step)},
    )
    resp.raise_for_status()
    results = resp.json().get("data", {}).get("result", [])
    if not results:
        return {}
    return {float(ts): int(float(val)) for ts, val in results[0].get("values", [])}
