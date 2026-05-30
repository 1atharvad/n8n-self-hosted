import os
import time

from fastapi import APIRouter, Depends, HTTPException, Query

from routers.utils import verify_api_key

router = APIRouter(prefix="/cpu-gate", tags=["CPU Gate"])

THRESHOLD = float(os.environ.get("CPU_GATE_THRESHOLD", 65))
EWMA_ALPHA_UP = float(os.environ.get("EWMA_ALPHA_UP", 0.5))
EWMA_ALPHA_DOWN = float(os.environ.get("EWMA_ALPHA_DOWN", 0.1))

_cpu_ema: float | None = None
_ema_samples: int = 0


def _host_cpu_percent() -> float:
    for proc_path in ("/host/proc/stat", "/proc/stat"):
        try:
            lines = open(proc_path).readlines()
            break
        except FileNotFoundError:
            continue
    else:
        return 0.0

    def parse(line: str):
        fields = line.split()
        total = sum(int(f) for f in fields[1:])
        idle = int(fields[4])
        return total, idle

    first = parse(lines[0])
    time.sleep(0.5)
    lines2 = open(proc_path).readlines()
    second = parse(lines2[0])

    total_delta = second[0] - first[0]
    idle_delta = second[1] - first[1]
    if total_delta == 0:
        return 0.0
    return round((1 - idle_delta / total_delta) * 100, 1)


def _sample() -> dict:
    global _cpu_ema, _ema_samples
    cpu_raw = _host_cpu_percent()
    if _cpu_ema is None:
        _cpu_ema = cpu_raw
    elif cpu_raw > _cpu_ema:
        _cpu_ema = EWMA_ALPHA_UP * cpu_raw + (1 - EWMA_ALPHA_UP) * _cpu_ema
    else:
        _cpu_ema = EWMA_ALPHA_DOWN * cpu_raw + (1 - EWMA_ALPHA_DOWN) * _cpu_ema
    _cpu_ema = round(_cpu_ema, 1)
    _ema_samples += 1

    cpu_effective = round(max(_cpu_ema, cpu_raw), 1)
    return {
        "cpu_raw": cpu_raw,
        "cpu_ema": _cpu_ema,
        "cpu_effective": cpu_effective,
        "threshold": THRESHOLD,
        "warmed_up": _ema_samples >= 5,
        "ready": cpu_effective < THRESHOLD,
    }


@router.get("", dependencies=[Depends(verify_api_key)])
async def get_cpu():
    return _sample()


@router.post("/wait", dependencies=[Depends(verify_api_key)])
async def wait_until_ready(
    timeout: int = Query(
        default=300,
        ge=30,
        le=1800,
        description="Maximum seconds to wait for CPU to drop below threshold (min: 30s, max: 1800s / 30 min). Default: 300s (5 min).",
    ),
):
    """Block until CPU drops below threshold or timeout is reached. Returns immediately when ready. Poll interval is 30s."""
    poll_interval = 30
    deadline = time.monotonic() + timeout

    while True:
        result = _sample()
        if result["ready"]:
            return result
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise HTTPException(status_code=408, detail=f"CPU did not drop below {THRESHOLD}% within {timeout}s")
        time.sleep(min(poll_interval, remaining))


@router.post("/reset", dependencies=[Depends(verify_api_key)])
async def reset_ema():
    """Reset the EMA state — useful after a deploy or known CPU spike."""
    global _cpu_ema, _ema_samples
    _cpu_ema = None
    _ema_samples = 0
    return {"reset": True}
