---
title: Environment Variables Reference
description: Every .env variable — what it does, which service uses it, and whether it is required, optional, or set automatically by Ansible.
sidebar:
  order: 4
---

All configuration lives in a single `.env` file at the project root. Docker Compose reads it and passes variables to each container.

**Legend:**
- **REQUIRED** — the stack will not start correctly without this value
- **optional** — has a working default; override only if needed
- **AUTO** — written by Ansible on server deploy; set manually for local dev

---

## Admin Panel

| Variable | Required | Default | Description |
|---|---|---|---|
| `JWT_SECRET` | REQUIRED | — | Signs admin panel JWT tokens. Generate with `openssl rand -hex 32`. Never change after users are logged in — it invalidates all sessions. |
| `LOGS_ADMIN_USERNAME` | optional | `admin` | Login username for the admin panel. |
| `LOGS_ADMIN_PASSWORD` | REQUIRED | — | Login password for the admin panel. |
| `JWT_EXPIRE_HOURS` | optional | `24` | How long admin panel sessions last before requiring re-login. |

**Used by:** `admin-api`

---

## PostgreSQL

| Variable | Required | Default | Description |
|---|---|---|---|
| `POSTGRES_USER` | REQUIRED | — | Database superuser username. Used by n8n, Media API, and Admin API. |
| `POSTGRES_PASSWORD` | REQUIRED | — | Database superuser password. |
| `POSTGRES_DB` | REQUIRED | — | Name of the primary database (e.g. `mydb`). |
| `POSTGRES_PORT` | optional | `5432` | PostgreSQL port. Change only if you have a port conflict. |
| `POSTGRES_HOST` | AUTO | `postgres` | Hostname of the PostgreSQL container. Set to `postgres` inside Docker; override only if using an external database. |

**Used by:** `postgres`, `n8n`, `media-api`, `admin-api`

---

## MinIO (object storage)

| Variable | Required | Default | Description |
|---|---|---|---|
| `MINIO_ROOT_USER` | REQUIRED | — | MinIO admin username (acts as access key). |
| `MINIO_ROOT_PASSWORD` | REQUIRED | — | MinIO admin password (acts as secret key). Minimum 8 characters. |
| `MINIO_BUCKET_NAME` | REQUIRED | — | Name of the bucket used for video file storage. |
| `MINIO_ENDPOINT` | AUTO | `http://minio:9000` | Internal endpoint used by the Media API to connect to MinIO. |

**Used by:** `minio`, `media-api`

---

## n8n

| Variable | Required | Default | Description |
|---|---|---|---|
| `N8N_ENCRYPTION_KEY` | REQUIRED | — | Encrypts all saved credentials in the database. Generate with `openssl rand -hex 32`. **Do not change after first run** — changing it makes all existing credentials unreadable. |
| `N8N_BASIC_AUTH_USER` | REQUIRED | — | Username for the n8n UI login. |
| `N8N_BASIC_AUTH_PASSWORD` | REQUIRED | — | Password for the n8n UI login. |
| `N8N_API_KEY` | optional | — | n8n REST API key. Generate in n8n UI: **Settings → n8n API → Create API Key**. Required for workflow sync scripts and the docs workflow canvas feature. |
| `N8N_EDITOR_BASE_URL` | REQUIRED | — | Public URL where n8n is accessible (e.g. `https://n8n.example.com`). Used to build webhook URLs and OAuth redirect URIs. |
| `WEBHOOK_TUNNEL_URL` | REQUIRED | — | Public URL for incoming webhooks. Usually the same as `N8N_EDITOR_BASE_URL`. |
| `VUE_APP_URL_BASE_API` | REQUIRED | — | Base URL the admin frontend uses to call the Admin API. Usually the same as `N8N_EDITOR_BASE_URL`. |
| `N8N_PORT` | AUTO | `5678` | Internal port n8n listens on inside the container. |
| `N8N_PROTOCOL` | AUTO | `https` | Protocol n8n uses to build URLs. Set to `http` for local dev without SSL. |
| `N8N_LISTEN_ADDRESS` | AUTO | `0.0.0.0` | Network interface n8n binds to inside the container. |
| `N8N_SECURE_COOKIE` | AUTO | `false` | Whether session cookies require HTTPS. Set `false` in dev; Ansible sets `false` because SSL is terminated at Nginx. |
| `N8N_TRUST_PROXY` | AUTO | `1` | Tells n8n to trust the `X-Forwarded-*` headers from Nginx. Required for correct IP logging and cookie handling behind a proxy. |
| `N8N_PROXY_HOPS` | AUTO | `2` | Number of proxy hops to trust (Nginx + any upstream load balancer). |
| `N8N_BASIC_AUTH_ACTIVE` | AUTO | `true` | Enables HTTP Basic Auth on the n8n UI. |
| `N8N_BASE_URL` | AUTO | `http://n8n:5678` | Internal URL other containers use to reach n8n directly (bypasses Nginx). |
| `EXECUTIONS_TIMEOUT` | AUTO | `10800` | Max execution time in seconds (3 hours). Workflows running longer than this are killed. |
| `EXECUTIONS_DATA_MAX_AGE` | AUTO | `168` | How long execution logs are kept in hours (7 days). Older logs are pruned automatically. |
| `QUEUE_BULL_REDIS_TIMEOUT_THRESHOLD` | AUTO | `3900000` | Milliseconds before a Bull job is considered stalled. |
| `QUEUE_BULL_MAX_STALLED_COUNT` | AUTO | `10` | How many times a stalled job is retried before being marked failed. |
| `QUEUE_BULL_STALLED_INTERVAL` | AUTO | `300000` | How often Bull checks for stalled jobs (milliseconds). |

**Used by:** `n8n`, `n8n-worker`

---

## Media API (FastAPI)

| Variable | Required | Default | Description |
|---|---|---|---|
| `API_KEY` | REQUIRED | — | Secret key required on all Media API requests via the `X-API-Key` header. Use any long random string. |
| `ADMIN_USERNAME` | optional | `admin` | Username for the FastAPI SQLAdmin panel (`/api/core/admin`). |
| `ADMIN_PASSWORD` | REQUIRED | — | Password for the FastAPI SQLAdmin panel. |
| `ADMIN_SECRET_KEY` | REQUIRED | — | Used to sign FastAPI admin session cookies. Generate with `openssl rand -hex 32`. |

**Used by:** `media-api`

---

## Internal Services

| Variable | Required | Default | Description |
|---|---|---|---|
| `INTERNAL_SECRET` | REQUIRED | — | Shared secret for service-to-service calls (e.g. audit log ingestion from Media API → Admin API). Any long random string. |
| `ADMIN_API_URL` | AUTO | `http://admin-api:8080` | Internal URL containers use to reach the Admin API directly. |
| `DB_TYPE` | AUTO | `postgresdb` | n8n database type. Always `postgresdb` in this stack. |
| `DB_POSTGRESDB_HOST` | AUTO | `postgres` | Hostname n8n uses to reach PostgreSQL. |

---

## Redis

| Variable | Required | Default | Description |
|---|---|---|---|
| `REDIS_HOST` | AUTO | `redis` | Hostname of the Redis container. |
| `REDIS_PORT` | AUTO | `6379` | Redis port. |

**Used by:** `n8n`, `n8n-worker`, `admin-api`, `worker-monitor`

---

## Worker Monitor

| Variable | Required | Default | Description |
|---|---|---|---|
| `SERVER_ID` | optional | `main` | Label shown in the admin dashboard to identify which server this monitor is running on. Set to `worker` on worker servers. |
| `WORKER_MONITOR_POLL_SEC` | optional | `30` | How often (in seconds) the monitor polls CPU, memory, Docker state, and n8n executions. |
| `CPU_GATE_THRESHOLD` | optional | `35` | CPU usage percentage above which the `/cpu-gate` endpoint returns "busy". Prevents new pipeline runs from starting on an overloaded machine. |

**Used by:** `worker-monitor`, `media-api` (reads `CPU_GATE_THRESHOLD`)

---

## Misc

| Variable | Required | Default | Description |
|---|---|---|---|
| `GENERIC_TIMEZONE` | optional | `UTC` | Timezone used by n8n for cron schedules and timestamp display. Use IANA format e.g. `America/New_York`, `Asia/Kolkata`. |
| `NODE_OPTIONS` | AUTO | `--max-old-space-size=4096` | Node.js memory limit. Increase if n8n runs out of memory on large executions. |
| `HOST_PROJECT_DIR` | REQUIRED (local) | — | Absolute path to the project root on the host machine. Used in volume mounts. Set automatically by the npm scripts; set manually if running compose directly. |

---

## Generating secrets

```bash
# Encryption/JWT keys — 64 hex chars (256-bit)
openssl rand -hex 32

# API keys — shorter, still strong
openssl rand -hex 16

# Quick password
openssl rand -base64 18 | tr -d '=+/'
```

---

## Adding a new variable

1. Add it to `.env.example` with a comment.
2. Add it to the relevant service's `environment:` block in all three compose files (`docker-compose.dev.yml`, `docker-compose.prod.yml`, `docker-compose.prod-main.yml`).
3. Add it to `ansible/playbooks/group_vars/all.yml` if Ansible needs to set it on the server.
4. Restart the affected container: `docker restart <container-name>`.
