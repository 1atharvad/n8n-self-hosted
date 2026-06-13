"""
n8n worker monitor.

Polls host CPU, the n8n execution API (with Redis fallback), and running Docker
containers, then pushes a snapshot to Redis under worker-monitor:metrics:<server>.
The admin-api reads these snapshots and serves them to the dashboard.

Active job count prefers the n8n REST API over Bull's Redis list because Bull
retains stale entries when jobs are stopped ungracefully.

Configuration via environment variables (all optional, defaults shown):
  REDIS_HOST                redis
  REDIS_PORT                6379
  N8N_BASE_URL              http://n8n:5678
  N8N_API_KEY               (required for API-based active count)
  POLL_INTERVAL_SEC         30
  EWMA_ALPHA_UP             0.5    EWMA weight when CPU is rising
  EWMA_ALPHA_DOWN           0.1    EWMA weight when CPU is falling
  COMPOSE_PROJECT_NAME      n8n-automation   (used to filter docker ps results)
  SERVER_ID                 <hostname>       (stable identity shown in dashboard)
"""

import json
import os
import socket
import subprocess
import time
import logging
import redis
import requests

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [worker-monitor] %(levelname)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)


def _env_int(name: str, default: int) -> int:
    return int(os.environ.get(name, default))


def _env_float(name: str, default: float) -> float:
    return float(os.environ.get(name, default))


def _env_str(name: str, default: str) -> str:
    return os.environ.get(name, default)


REDIS_HOST = _env_str("REDIS_HOST", "redis")
REDIS_PORT = _env_int("REDIS_PORT", 6379)
N8N_BASE_URL = _env_str("N8N_BASE_URL", "http://n8n:5678")
N8N_API_KEY = _env_str("N8N_API_KEY", "")
POLL_INTERVAL_SEC = _env_int("POLL_INTERVAL_SEC", 30)
EWMA_ALPHA_UP = _env_float("EWMA_ALPHA_UP", 0.5)
EWMA_ALPHA_DOWN = _env_float("EWMA_ALPHA_DOWN", 0.1)
COMPOSE_PROJECT = _env_str("COMPOSE_PROJECT_NAME", "n8n-automation")
SERVER_ID = _env_str("SERVER_ID", socket.gethostname())
CPU_GATE_THRESHOLD = _env_int("CPU_GATE_THRESHOLD", 65)
MEDIA_API_URL = _env_str("MEDIA_API_URL", "http://media-api:9374")

BULL_ACTIVE_KEY = "bull:jobs:active"
REDIS_KEY = f"worker-monitor:metrics:{SERVER_ID}"


def host_cpu_percent() -> float:
    """Read CPU % from /host/proc/stat (host mount) or /proc/stat (fallback)."""
    for proc_path in ("/host/proc/stat", "/proc/stat"):
        try:
            lines = open(proc_path).readlines()
            break
        except FileNotFoundError:
            continue
    else:
        log.warning("Cannot read /proc/stat — returning 0% CPU")
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


def n8n_active_count() -> int | None:
    """
    Return running execution count from the n8n REST API.
    Returns None if the API is unavailable or N8N_API_KEY is not set.
    Preferred over Bull's Redis list which retains stale entries after ungraceful stops.
    """
    if not N8N_API_KEY:
        return None
    try:
        resp = requests.get(
            f"{N8N_BASE_URL}/api/v1/executions",
            headers={"X-N8N-API-KEY": N8N_API_KEY},
            params={"limit": 250},
            timeout=5,
        )
        resp.raise_for_status()
        data = resp.json().get("data", [])
        return sum(1 for e in data if e.get("status") == "running")
    except Exception as exc:
        log.warning(f"n8n API unavailable, falling back to Redis for active count: {exc}")
        return None


def active_count(r: redis.Redis) -> tuple[int, str]:
    """Return (count, source) — source is 'api' or 'redis'."""
    api = n8n_active_count()
    if api is not None:
        return api, "api"
    return int(r.llen(BULL_ACTIVE_KEY)), "redis"


def running_containers() -> list[str]:
    """Return names of all running containers in this compose project."""
    try:
        result = subprocess.run(
            [
                "docker", "ps",
                "--filter", f"label=com.docker.compose.project={COMPOSE_PROJECT}",
                "--filter", "status=running",
                "--format", "{{.Names}}",
            ],
            capture_output=True,
            text=True,
            timeout=10,
        )
        return [l.strip() for l in result.stdout.splitlines() if l.strip()]
    except Exception as exc:
        log.warning(f"running_containers failed: {exc}")
        return []


def container_cpu_stats() -> dict[str, float]:
    """Return {container_name: cpu_pct} for all running containers."""
    try:
        result = subprocess.run(
            ["docker", "stats", "--no-stream", "--format", "{{.Name}}\t{{.CPUPerc}}"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        stats: dict[str, float] = {}
        for line in result.stdout.splitlines():
            parts = line.strip().split("\t")
            if len(parts) == 2:
                name = parts[0].strip()
                cpu_str = parts[1].strip().rstrip("%")
                try:
                    stats[name] = float(cpu_str)
                except ValueError:
                    pass
        return stats
    except Exception as exc:
        log.warning(f"container_cpu_stats failed: {exc}")
        return {}


def run():
    log.info(
        f"Starting worker-monitor | server={SERVER_ID} redis={REDIS_HOST}:{REDIS_PORT} "
        f"n8n={N8N_BASE_URL} api_key={'set' if N8N_API_KEY else 'not set'} "
        f"poll={POLL_INTERVAL_SEC}s key={REDIS_KEY}"
    )

    r = None
    while r is None:
        try:
            r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, socket_connect_timeout=5)
            r.ping()
            log.info(f"Connected to Redis at {REDIS_HOST}:{REDIS_PORT}")
        except Exception as exc:
            log.warning(f"Redis not ready ({exc}), retrying in 5s…")
            r = None
            time.sleep(5)

    cpu_ema: float | None = None

    while True:
        try:
            cpu_raw = host_cpu_percent()
            if cpu_ema is None:
                cpu_ema = cpu_raw
            elif cpu_raw > cpu_ema:
                cpu_ema = EWMA_ALPHA_UP * cpu_raw + (1 - EWMA_ALPHA_UP) * cpu_ema
            else:
                cpu_ema = EWMA_ALPHA_DOWN * cpu_raw + (1 - EWMA_ALPHA_DOWN) * cpu_ema
            cpu_ema = round(cpu_ema, 1)
            cpu_effective = round(max(cpu_ema, cpu_raw), 1)

            active, active_src = active_count(r)
            containers = running_containers()
            cpu_stats = container_cpu_stats()

            log.info(
                f"cpu={cpu_effective:.1f}% (ema={cpu_ema:.1f}% raw={cpu_raw:.1f}%)  "
                f"active={active}({active_src})  containers={len(containers)}"
            )

            snapshot = json.dumps({
                "ts": time.time(),
                "cpu_raw": cpu_raw,
                "cpu_ema": cpu_ema,
                "cpu_effective": cpu_effective,
                "threshold": CPU_GATE_THRESHOLD,
                "active": active,
                "active_src": active_src,
                "containers": containers,
                "container_cpu": cpu_stats,
                "media_api_url": MEDIA_API_URL,
            })
            r.lpush(REDIS_KEY, snapshot)
            r.ltrim(REDIS_KEY, 0, 199)
            r.expire(REDIS_KEY, POLL_INTERVAL_SEC * 10)

        except redis.RedisError as exc:
            log.error(f"Redis error: {exc}")
        except Exception as exc:
            log.exception(f"Unexpected error in monitor loop: {exc}")

        time.sleep(POLL_INTERVAL_SEC)


if __name__ == "__main__":
    run()
