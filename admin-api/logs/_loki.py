import datetime

import httpx

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


def escape_logql(s: str) -> str:
    return s.replace("\\", "\\\\").replace('"', '\\"')


def ns_to_iso(ts_ns: str) -> str:
    secs = int(ts_ns) / 1e9
    dt = datetime.datetime.fromtimestamp(secs, tz=datetime.timezone.utc)
    return dt.isoformat()


def extract_level(line: str, labels: dict) -> str:
    for key in ("level", "severity", "log_level"):
        if key in labels:
            return labels[key]
    upper = line[:80].upper()
    for lvl in ("ERROR", "CRITICAL", "WARNING", "WARN", "INFO", "DEBUG"):
        if lvl in upper:
            return lvl.lower()
    return "info"


def extract_max_ts_ns(data: dict) -> int | None:
    max_ns: int | None = None
    for stream in data.get("data", {}).get("result", []):
        for ts_ns, _ in stream.get("values", []):
            ns = int(ts_ns)
            if max_ns is None or ns > max_ns:
                max_ns = ns
    return max_ns


def parse_loki_response(data: dict) -> list[dict]:
    entries: list[dict] = []
    for stream in data.get("data", {}).get("result", []):
        labels = stream.get("stream", {})
        container = (
            labels.get("container_name")
            or labels.get("container")
            or labels.get("service_name")
            or "unknown"
        )
        for ts_ns, line in stream.get("values", []):
            entries.append({
                "ts": ns_to_iso(ts_ns),
                "container": container,
                "level": extract_level(line, labels),
                "message": line,
            })
    entries.sort(key=lambda e: e["ts"])
    return entries


async def loki_containers(client: httpx.AsyncClient) -> list[str]:
    import time
    now_ns = int(time.time() * 1e9)
    start_ns = now_ns - int(86400 * 1e9)
    resp = await client.get(
        f"{LOKI_BASE}/loki/api/v1/label/container/values",
        params={"start": str(start_ns), "end": str(now_ns)},
    )
    resp.raise_for_status()
    return sorted(resp.json().get("data", []))


async def loki_count(client: httpx.AsyncClient, selector: str, duration: str, now_s: int) -> int:
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


async def loki_series(
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
