import asyncio
import json
import time
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse

from auth.security import get_current_user
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
async def get_labels(current_user: User = Depends(get_current_user)):
    """Return the list of container names known to Loki, filtered by allowed_containers."""
    url = f"{LOKI_BASE}/loki/api/v1/label/container/values"
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            resp = await client.get(url)
            resp.raise_for_status()
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"Loki unreachable: {e}")

    data = resp.json()
    labels: list[str] = sorted(data.get("data", []))

    # Restrict to the user's container allowlist (NULL = all containers)
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
        selector = '{job="docker"}'

    # Build pipeline stages
    pipeline = ""
    if search:
        escaped = search.replace('"', '\\"')
        pipeline += f' |= "{escaped}"'
    if level and level != "all":
        pipeline += f' | level="{level.lower()}"'

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
        base = '{job="docker"}'

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


@router.get("/autoscaler-metrics")
async def get_autoscaler_metrics(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """Return the last 200 autoscaler metric snapshots stored by worker-autoscaler."""
    try:
        raw = await request.app.state.redis.lrange("autoscaler:metrics", 0, 199)
    except Exception:
        return JSONResponse({"metrics": []})

    points = []
    for item in raw:
        try:
            points.append(json.loads(item))
        except Exception:
            pass

    points.reverse()  # LPUSH stores newest first; reverse to chronological
    return JSONResponse({"metrics": points})


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
