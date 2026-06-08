import asyncio
import json
import os
import time

import redis.asyncio as aioredis
from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/cpu-gate", tags=["CPU Gate"])

THRESHOLD = float(os.environ.get("CPU_GATE_THRESHOLD", 65))
SERVER_ID = os.environ.get("SERVER_ID", "")
REDIS_HOST = os.environ.get("REDIS_HOST", "redis")
REDIS_PORT = int(os.environ.get("REDIS_PORT", 6379))

_redis: aioredis.Redis | None = None


def _get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.Redis(
            host=REDIS_HOST, port=REDIS_PORT, decode_responses=True
        )
    return _redis


async def _latest_snapshot() -> dict | None:
    """Return the most recent worker-monitor snapshot from Redis, or None on failure."""
    try:
        r = _get_redis()
        if SERVER_ID:
            raw = await r.lindex(f"worker-monitor:metrics:{SERVER_ID}", 0)
            if raw:
                return json.loads(raw)
        keys = await r.keys("worker-monitor:metrics:*")
        snapshots = []
        for key in keys:
            raw = await r.lindex(key, 0)
            if raw:
                snapshots.append(json.loads(raw))
        return (
            max(snapshots, key=lambda s: s.get("ts", 0)) if snapshots else None
        )
    except Exception:
        return None


def _local_cpu() -> float:
    """Fallback: measure CPU directly from /proc/stat."""
    for path in ("/host/proc/stat", "/proc/stat"):
        try:
            lines = open(path).readlines()
            break
        except FileNotFoundError:
            continue
    else:
        return 0.0

    def parse(line: str):
        f = line.split()
        total = sum(int(x) for x in f[1:])
        return total, int(f[4])

    t1, i1 = parse(lines[0])
    time.sleep(0.5)
    lines2 = open(path).readlines()
    t2, i2 = parse(lines2[0])
    delta = t2 - t1
    return round((1 - (i2 - i1) / delta) * 100, 1) if delta else 0.0


def _build_result(
    cpu_raw: float, cpu_ema: float, warmed_up: bool, source: str
) -> dict:
    cpu_effective = round(max(cpu_ema, cpu_raw), 1)
    return {
        "cpu_raw": cpu_raw,
        "cpu_ema": cpu_ema,
        "cpu_effective": cpu_effective,
        "threshold": THRESHOLD,
        "warmed_up": warmed_up,
        "ready": cpu_effective < THRESHOLD,
        "source": source,
    }


_local_ema: float | None = None
_local_samples: int = 0
EWMA_ALPHA_UP = float(os.environ.get("EWMA_ALPHA_UP", 0.5))
EWMA_ALPHA_DOWN = float(os.environ.get("EWMA_ALPHA_DOWN", 0.1))


def _sample_local() -> dict:
    global _local_ema, _local_samples
    cpu_raw = _local_cpu()
    if _local_ema is None:
        _local_ema = cpu_raw
    elif cpu_raw > _local_ema:
        _local_ema = EWMA_ALPHA_UP * cpu_raw + (1 - EWMA_ALPHA_UP) * _local_ema
    else:
        _local_ema = (
            EWMA_ALPHA_DOWN * cpu_raw + (1 - EWMA_ALPHA_DOWN) * _local_ema
        )
    _local_ema = round(_local_ema, 1)
    _local_samples += 1
    return _build_result(cpu_raw, _local_ema, _local_samples >= 5, "local")


async def _sample() -> dict:
    snapshot = await _latest_snapshot()
    if snapshot is not None:
        return _build_result(
            snapshot.get("cpu_raw", 0.0),
            snapshot.get("cpu_ema", 0.0),
            warmed_up=True,
            source="worker-monitor",
        )
    return _sample_local()


@router.get("")
async def get_cpu():
    return await _sample()


@router.get("/wait")
async def wait_until_ready(
    timeout: int = Query(
        default=300,
        ge=30,
        le=1800,
        description="Maximum seconds to wait for CPU to drop below threshold (min: 30s, max: 1800s / 30 min). Default: 300s (5 min).",
    ),
):
    """Block until CPU drops below threshold or timeout is reached. Poll interval is 30s."""
    deadline = time.monotonic() + timeout
    while True:
        result = await _sample()
        if result["ready"]:
            return result
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise HTTPException(
                status_code=408,
                detail=f"CPU did not drop below {THRESHOLD}% within {timeout}s",
            )
        await asyncio.sleep(min(30, remaining))


@router.get("/reset")
async def reset_ema():
    """Reset the local EMA fallback state."""
    global _local_ema, _local_samples
    _local_ema = None
    _local_samples = 0
    return {"reset": True}
