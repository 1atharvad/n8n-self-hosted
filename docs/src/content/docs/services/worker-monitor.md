---
title: Worker Monitor
description: How worker-monitor polls CPU, executions, and Docker state, smooths with EWMA, and writes Redis snapshots.
sidebar:
  order: 3
---

**Container:** `worker-monitor`  
**Source:** `processes/`  
**No HTTP interface.** Writes exclusively to Redis.

A lightweight Python daemon that runs on every server (main and workers). It polls system state every `POLL_INTERVAL_SEC` seconds and writes a JSON snapshot to Redis. The Admin API reads these snapshots to populate the Dashboard, Performance page, and Infrastructure health checks.

## What it polls

Each tick collects:

1. **CPU** — reads `/proc/stat` twice with a 0.5s gap and computes raw CPU usage percentage.
2. **Smoothed CPU (EWMA)** — applies asymmetric exponential moving average (see below).
3. **Active n8n executions** — calls `GET /api/v1/executions?status=running` on n8n. Falls back to counting Bull queue entries in Redis if the n8n API is unreachable.
4. **Running Docker containers** — runs `docker ps` filtered by `COMPOSE_PROJECT_NAME`.
5. **Media API URL** — the URL of this server's media-api, included so the admin panel knows which host to call for container restarts.

## Redis snapshot

Written to key: `worker-monitor:metrics:<SERVER_ID>`

```json
{
  "cpu_raw": 42.1,
  "cpu_ema": 38.7,
  "cpu_effective": 38.7,
  "threshold": 65,
  "warmed_up": true,
  "ready": true,
  "active_executions": 2,
  "running_containers": ["n8n", "media-api", "admin-api", "nginx"],
  "media_api_url": "http://1.2.3.4:9374",
  "timestamp": 1719820000
}
```

## EWMA smoothing

The CPU is smoothed with an **asymmetric exponential moving average**:

```
if cpu_raw > cpu_ema:
    cpu_ema = α_up × cpu_raw + (1 − α_up) × cpu_ema
else:
    cpu_ema = α_down × cpu_raw + (1 − α_down) × cpu_ema
```

With defaults `α_up = 0.5` and `α_down = 0.1`:
- CPU spikes propagate **quickly** (50% weight to the new reading)
- CPU drops recover **slowly** (only 10% weight to the lower reading)

This prevents brief CPU bursts from immediately releasing the CPU gate — a 2-second spike still holds the gate closed for ~20-30 seconds while the EMA decays.

## CPU Gate integration

The `cpu_effective` field (same as `cpu_ema` in normal operation) is read by the Media API's `/cpu-gate` endpoints. When `cpu_effective > threshold`, the gate is `ready: false` and the Media API rejects new heavy jobs with a backoff response.

Workflows use `/cpu-gate/wait?timeout=300` to block until the gate opens before submitting video/TTS work.

## Configuration

| Variable | Default | Description |
|---|---|---|
| `REDIS_HOST` | `redis` | Redis hostname |
| `REDIS_PORT` | `6379` | Redis port |
| `N8N_BASE_URL` | `http://n8n:5678` | n8n internal URL |
| `N8N_API_KEY` | — | Required for execution count via n8n API |
| `POLL_INTERVAL_SEC` | `30` | Seconds between snapshots |
| `EWMA_ALPHA_UP` | `0.5` | EWMA weight when CPU is rising |
| `EWMA_ALPHA_DOWN` | `0.1` | EWMA weight when CPU is falling |
| `CPU_GATE_THRESHOLD` | `65` | CPU % above which the gate closes |
| `COMPOSE_PROJECT_NAME` | `n8n-automation` | Docker compose project filter for `docker ps` |
| `SERVER_ID` | hostname | Redis key suffix + dashboard label |
| `MEDIA_API_URL` | — | This server's media-api URL (included in snapshot) |

## Multi-server behaviour

Each server runs its own `worker-monitor` with a unique `SERVER_ID`. The admin panel reads all Redis keys matching `worker-monitor:metrics:*` and shows a per-server selector on the Performance and Infrastructure pages.

When the admin panel restarts a container on a specific server, it uses `media_api_url` from that server's snapshot to call the right media-api instance.
