"""
n8n worker autoscaler.

Watches host CPU % and the Redis Bull queue depth, then scales n8n-worker
containers up or down using `docker compose --scale`.

CPU smoothing uses asymmetric EWMA: rises quickly (alpha_up) to catch spikes,
decays slowly (alpha_down) to avoid premature scale-up after a brief idle period.

Active job count uses the n8n REST API as the source of truth (more reliable
than Redis bull:jobs:active, which retains stale entries when jobs are stopped
ungracefully). Falls back to Redis if the API is unavailable.

Configuration via environment variables (all optional, defaults shown):
  REDIS_HOST                 redis
  REDIS_PORT                 6379
  N8N_BASE_URL               http://n8n:5678
  N8N_API_KEY                (required to use API-based active count)
  COMPOSE_PROJECT_NAME       n8n-automation   (must match your project)
  COMPOSE_FILE               /app/docker-compose.prod.yml
  WORKER_COMPOSE_FILE        /app/docker-compose.worker.yml  (merged on top)
  ENV_FILE                   /app/.env  (passed to docker compose for variable substitution)
  MIN_WORKERS                1
  MAX_WORKERS                4
  CPU_SCALE_UP_MAX           65    scale up only if BOTH ema and raw CPU below this %
  CPU_SCALE_DOWN_EMERGENCY   88    force remove one worker if max(ema, raw) above this %
  IDLE_BEFORE_SCALEDOWN_SEC  120   idle queue seconds before scaling down
  POLL_INTERVAL_SEC          30
  COOLDOWN_SEC               90    minimum gap between two scale actions
  EWMA_ALPHA_UP              0.5   EWMA weight when CPU is rising  (higher = reacts faster)
  EWMA_ALPHA_DOWN            0.1   EWMA weight when CPU is falling (lower  = decays slower)
"""

import json
import os
import subprocess
import time
import logging
import redis
import requests

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [autoscaler] %(levelname)s %(message)s",
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
COMPOSE_PROJECT = _env_str("COMPOSE_PROJECT_NAME", "n8n-automation")
COMPOSE_FILE = _env_str("COMPOSE_FILE", "/app/docker-compose.prod.yml")
# Host filesystem path where the project root lives (needed so Docker daemon
# resolves relative volume paths in the compose file against the host, not /app).
HOST_PROJECT_DIR = _env_str("HOST_PROJECT_DIR", "")
# Path to .env file passed to docker compose so variable substitution works.
ENV_FILE = _env_str("ENV_FILE", "/app/.env")
# Optional second compose file merged on top (used in prod to add worker service).
# Leave empty when the worker service is already defined in COMPOSE_FILE (e.g. dev).
WORKER_COMPOSE_FILE = _env_str("WORKER_COMPOSE_FILE", "")
MIN_WORKERS = _env_int("MIN_WORKERS", 1)
MAX_WORKERS = _env_int("MAX_WORKERS", 4)
CPU_SCALE_UP_MAX = _env_int("CPU_SCALE_UP_MAX", 65)
CPU_SCALE_DOWN_EMERGENCY = _env_int("CPU_SCALE_DOWN_EMERGENCY", 88)
IDLE_BEFORE_SCALEDOWN_SEC = _env_int("IDLE_BEFORE_SCALEDOWN_SEC", 120)
POLL_INTERVAL_SEC = _env_int("POLL_INTERVAL_SEC", 30)
COOLDOWN_SEC = _env_int("COOLDOWN_SEC", 90)
EWMA_ALPHA_UP = _env_float("EWMA_ALPHA_UP", 0.5)
EWMA_ALPHA_DOWN = _env_float("EWMA_ALPHA_DOWN", 0.1)

# n8n uses Bull queue named "jobs"
BULL_WAIT_KEY = "bull:jobs:wait"
BULL_ACTIVE_KEY = "bull:jobs:active"


def host_cpu_percent() -> float:
    """
    Read CPU usage from /host/proc/stat (the host's /proc mounted read-only).
    Falls back to /proc/stat if the host mount is absent (e.g. local dev).
    Returns a float 0–100.
    """
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
    Return the number of currently running executions from the n8n API.
    Returns None if the API is unavailable or not configured.
    Bull's active list retains stale entries when jobs are stopped ungracefully;
    the n8n API reflects the true running state.
    """
    if not N8N_API_KEY:
        return None
    try:
        resp = requests.get(
            f"{N8N_BASE_URL}/api/v1/executions",
            headers={"X-N8N-API-KEY": N8N_API_KEY},
            params={"status": "running", "limit": 250},
            timeout=5,
        )
        resp.raise_for_status()
        data = resp.json().get("data", [])
        return len(data)
    except Exception as exc:
        log.warning(f"n8n API unavailable, falling back to Redis for active count: {exc}")
        return None


def queue_depths(r: redis.Redis) -> tuple[int, int, str]:
    """Return (waiting, active, active_source) job counts."""
    waiting = r.llen(BULL_WAIT_KEY)
    api_active = n8n_active_count()
    if api_active is not None:
        return int(waiting), api_active, "api"
    return int(waiting), int(r.llen(BULL_ACTIVE_KEY)), "redis"


def current_worker_count() -> int:
    """Count running containers belonging to the n8n-worker service."""
    result = subprocess.run(
        [
            "docker", "ps",
            "--filter", f"label=com.docker.compose.project={COMPOSE_PROJECT}",
            "--filter", "label=com.docker.compose.service=n8n-worker",
            "--filter", "status=running",
            "--format", "{{.ID}}",
        ],
        capture_output=True,
        text=True,
    )
    ids = [line.strip() for line in result.stdout.splitlines() if line.strip()]
    return len(ids)


def scale_to(n: int) -> bool:
    """
    Run `docker compose up --scale n8n-worker=N -d --no-recreate`.
    Returns True on success.
    """
    n = max(MIN_WORKERS, min(MAX_WORKERS, n))
    cmd = ["docker", "compose", "-p", COMPOSE_PROJECT]

    if HOST_PROJECT_DIR:
        cmd += ["--project-directory", HOST_PROJECT_DIR]

    if ENV_FILE:
        cmd += ["--env-file", ENV_FILE]
    cmd += ["-f", COMPOSE_FILE]

    if WORKER_COMPOSE_FILE:
        cmd += ["-f", WORKER_COMPOSE_FILE]
    cmd += ["up", "--scale", f"n8n-worker={n}", "-d", "--no-recreate", "n8n-worker"]
    log.info(f"Scaling n8n-worker to {n}: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0:
        log.error(f"Scale command failed:\n{result.stderr}")
        return False

    if result.stdout:
        log.info(f"Scale output:\n{result.stdout}")
    return True


def run():
    log.info(
        f"Starting autoscaler | min={MIN_WORKERS} max={MAX_WORKERS} "
        f"cpu_up_max={CPU_SCALE_UP_MAX}% cpu_emergency={CPU_SCALE_DOWN_EMERGENCY}% "
        f"idle_down={IDLE_BEFORE_SCALEDOWN_SEC}s poll={POLL_INTERVAL_SEC}s cooldown={COOLDOWN_SEC}s "
        f"ewma_alpha_up={EWMA_ALPHA_UP} ewma_alpha_down={EWMA_ALPHA_DOWN}"
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

    last_scale_time = 0.0
    idle_since: float | None = None
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
            cpu = round(max(cpu_ema, cpu_raw), 1)
            waiting, active, active_src = queue_depths(r)
            workers = current_worker_count()
            now = time.monotonic()

            log.info(f"cpu={cpu:.1f}% (ema={cpu_ema:.1f}% raw={cpu_raw:.1f}%)  waiting={waiting}  active={active}({active_src})  workers={workers}")

            try:
                snapshot = json.dumps({
                    "ts": time.time(),
                    "cpu_raw": cpu_raw,
                    "cpu_ema": cpu_ema,
                    "workers": workers,
                    "waiting": waiting,
                    "active": active,
                    "active_src": active_src,
                })
                r.lpush("autoscaler:metrics", snapshot)
                r.ltrim("autoscaler:metrics", 0, 199)
            except Exception as exc:
                log.warning(f"Failed to push metrics to Redis: {exc}")

            cooldown_ok = (now - last_scale_time) >= COOLDOWN_SEC
            desired = workers  # default: no change

            # --- Emergency scale-down: CPU is critically high ---
            if cpu > CPU_SCALE_DOWN_EMERGENCY and workers > MIN_WORKERS:
                log.warning(f"CPU {cpu:.1f}% > emergency threshold {CPU_SCALE_DOWN_EMERGENCY}% — removing one worker")
                desired = workers - 1

            # --- Scale up: work queued and both ema and raw have headroom ---
            elif waiting > 0 and cpu_ema < CPU_SCALE_UP_MAX and cpu_raw < CPU_SCALE_UP_MAX and workers < MAX_WORKERS:
                log.info(f"Queue has {waiting} waiting jobs and CPU has headroom (ema={cpu_ema:.1f}% raw={cpu_raw:.1f}% < {CPU_SCALE_UP_MAX}%) — adding worker")
                desired = workers + 1

            # --- Scale down: queue empty long enough ---
            elif waiting == 0 and active == 0 and workers > MIN_WORKERS:
                if idle_since is None:
                    idle_since = now
                idle_secs = now - idle_since
                log.info(f"Queue idle for {idle_secs:.0f}s / {IDLE_BEFORE_SCALEDOWN_SEC}s threshold")
                if idle_secs >= IDLE_BEFORE_SCALEDOWN_SEC:
                    log.info("Idle threshold reached — removing one worker")
                    desired = workers - 1
                    idle_since = None  # reset after triggering
            else:
                idle_since = None  # reset if there's activity

            if desired != workers and cooldown_ok:
                if scale_to(desired):
                    last_scale_time = now
            elif desired != workers:
                log.info(f"Scale needed ({workers}→{desired}) but cooldown active ({COOLDOWN_SEC - (now - last_scale_time):.0f}s remaining)")

        except redis.RedisError as exc:
            log.error(f"Redis error: {exc}")
        except Exception as exc:
            log.exception(f"Unexpected error in autoscaler loop: {exc}")

        time.sleep(POLL_INTERVAL_SEC)


if __name__ == "__main__":
    run()
