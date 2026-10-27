---
title: Incident Runbook
description: What to do when things break — common incidents, symptoms, diagnosis steps, and fixes.
sidebar:
  order: 6
---

Quick reference for diagnosing and recovering from common failures. Start with the [Admin Panel → Infrastructure](/docs/admin-panel/infrastructure/) page before SSHing — it shows container status and lets you restart without leaving the browser.

---

## n8n is down / UI not loading

**Symptoms:** Browser shows 502 Bad Gateway or the n8n login page does not load.

**Diagnose:**
```bash
docker ps --filter name=n8n --format '{{.Names}} {{.Status}}'
docker logs --tail 50 n8n
```

**Common causes and fixes:**

| Cause | Fix |
|---|---|
| Container crashed (exits repeatedly) | Check logs for `Error` or `FATAL`. Most common: wrong `N8N_ENCRYPTION_KEY` or DB unreachable. |
| PostgreSQL not ready on startup | `docker restart n8n` — n8n will reconnect once Postgres is up. |
| Out of memory | Add `NODE_OPTIONS=--max-old-space-size=8192` to `.env` and restart. |
| Nginx cannot reach n8n | Verify both containers are on the same Docker network: `docker network inspect n8n-automation_baota_net`. |

```bash
# Restart n8n (preserves data)
docker restart n8n

# If still failing, check Postgres is healthy
docker exec postgres pg_isready -U $POSTGRES_USER
```

---

## Workers not picking up jobs

**Symptoms:** Workflows trigger but stay in "waiting" or "queued" state indefinitely. n8n UI shows executions stuck.

**Diagnose:**
```bash
docker logs --tail 50 n8n-worker
docker exec redis redis-cli LLEN bull:jobs:wait
```

**Common causes and fixes:**

| Cause | Fix |
|---|---|
| Worker container is down | `docker restart n8n-worker` |
| Redis connection lost | `docker restart redis && docker restart n8n-worker` |
| Bull queue is stalled | Check `QUEUE_BULL_MAX_STALLED_COUNT` — if stalled count exceeded, job is marked failed. Re-trigger manually. |
| Worker on a different network | Verify worker can reach Redis: `docker exec n8n-worker redis-cli -h redis ping` |

---

## Disk full

**Symptoms:** Containers crash with "no space left on device". Pipeline videos accumulate. Logs stop updating.

**Diagnose:**
```bash
df -h
docker system df
du -sh /path/to/project/n8n_files/*/
```

**Fix — free space immediately:**
```bash
# Delete old audio/video files (the Cleanup workflow does this at midnight)
rm -rf /path/to/project/n8n_files/audio_files/*
rm -rf /path/to/project/n8n_files/video_files/*

# Remove unused Docker images, stopped containers, dangling volumes
docker system prune -f

# Remove old Docker build cache
docker builder prune -f
```

**Fix — reclaim Loki log storage:**
```bash
# Stop Loki
docker stop loki

# Remove old chunks (keeps index)
rm -rf /path/to/project/loki-data/chunks/*

# Restart
docker start loki
```

**Prevent recurrence:** The **Cleanup & Reset Database** workflow runs at midnight and removes audio/video files. If it is inactive or failing, check its execution log in n8n.

---

## Pipeline not running (no video uploaded today)

**Symptoms:** It is past the scheduled time but no video appeared on YouTube. No obvious container errors.

**Diagnose in order:**

1. Check n8n executions — open n8n UI → Executions and filter by "Youtube Video Upload".
2. Check whether the trigger fired at all (look for an execution with status "waiting" or "error").
3. Check the CPU gate — if the machine was over `CPU_GATE_THRESHOLD` at trigger time, the Scheduler workflow skips the run.

```bash
# Check CPU gate endpoint directly
curl -s http://localhost:6060/api/core/cpu-gate

# Check worker-monitor Redis snapshot
docker exec redis redis-cli GET worker:main:snapshot | python3 -m json.tool
```

**Common causes:**

| Cause | Fix |
|---|---|
| n8n trigger did not fire (n8n was down at trigger time) | Trigger manually from n8n UI → run "Youtube Video Upload" |
| CPU gate blocked the run | Wait for CPU to drop, then trigger manually |
| Job Scrapper found no jobs | Check Media API logs for `/job-scrape/*` errors (LinkedIn/Indeed rate limiting or blocking) |
| Script Generator failed | OpenAI quota or API key issue — check Admin Panel → Logs for `openrouter` errors |
| Media API hung | `docker restart media-api` then re-trigger |

---

## Media API not responding

**Symptoms:** n8n workflows fail with connection errors to `/api/core/`. TTS, video creation, or file operations time out.

**Diagnose:**
```bash
docker logs --tail 100 media-api
curl -s -o /dev/null -w "%{http_code}" http://localhost:6060/api/core/health
```

**Common causes:**

| Cause | Fix |
|---|---|
| Container OOM-killed (heavy video processing) | `docker restart media-api` |
| A long-running job blocked the event loop | `docker restart media-api` — running jobs will need to be re-triggered |
| Wrong `API_KEY` in request | Check the `API_KEY` in `.env` matches what n8n credentials have configured |
| MinIO unreachable | `docker restart minio && docker restart media-api` |

---

## PostgreSQL issues

**Symptoms:** Containers log `FATAL: password authentication failed` or `could not connect to server`.

**Diagnose:**
```bash
docker exec postgres pg_isready -U $POSTGRES_USER -d $POSTGRES_DB
docker logs --tail 50 postgres
```

**Common fixes:**
```bash
# Restart PostgreSQL (safe — does not lose data)
docker restart postgres

# After restart, reconnect dependent services
docker restart n8n media-api admin-api

# Check if Alembic migrations are pending
docker exec media-api alembic current
docker exec media-api alembic upgrade head

# Connect manually for inspection
docker exec -it postgres psql -U $POSTGRES_USER -d $POSTGRES_DB
```

---

## Redis issues

**Symptoms:** n8n execution queue stalls. Worker monitor shows stale data. Workflows with Redis nodes fail.

**Diagnose:**
```bash
docker exec redis redis-cli ping          # should return PONG
docker exec redis redis-cli info memory   # check used_memory
docker logs --tail 50 redis
```

**Fix:**
```bash
# Restart Redis (clears in-memory state but AOF persistence preserves data)
docker restart redis

# After restart, worker-monitor and n8n-worker reconnect automatically
# If executions are still stuck, restart n8n-worker
docker restart n8n-worker
```

---

## Nginx returning 502 for a specific path

**Symptoms:** Most services work but one path (e.g. `/admin/`, `/docs/`) returns 502.

**Diagnose:**
```bash
# Check which backend container is down
docker ps --format '{{.Names}} {{.Status}}'

# Check nginx config parsed correctly
docker exec nginx nginx -t
```

**Fix:**
```bash
# Restart the specific backend
docker restart docs        # for /docs/
docker restart frontend    # for /admin/
docker restart admin-api   # for /api/admin/

# If nginx config was changed, reload without dropping connections
docker exec nginx nginx -s reload
```

---

## Logs not appearing in Admin Panel

**Symptoms:** Admin Panel → Logs page shows no output or stale logs for a container.

**Diagnose:**
```bash
# Check Promtail is running and shipping logs
docker logs --tail 50 promtail

# Check Loki is healthy
curl -s http://localhost:3100/ready
```

**Fix:**
```bash
docker restart promtail

# If Loki itself is unhealthy
docker restart loki && docker restart promtail
```

Promtail reads container stdout from `/var/lib/docker/containers/`. If Docker log rotation removed old logs, only new entries will appear after the restart.

---

## Full stack recovery after server reboot

After an unexpected server reboot Docker containers do not auto-start unless `restart: unless-stopped` is set (it is, for all services).

**Verify:**
```bash
docker ps --format '{{.Names}} {{.Status}}'
```

All containers should show `Up X minutes`. If any show `Exited`:

```bash
cd $DEPLOY_PATH
docker compose -f docker/docker-compose.prod.yml up -d
```

Then verify n8n can reach PostgreSQL and Redis before triggering any workflows.
