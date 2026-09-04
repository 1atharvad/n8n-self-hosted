---
title: Admin API
description: All modules and endpoints on the Admin API — auth, env vars, logs, infrastructure, backups, and n8n management.
sidebar:
  order: 2
---

**Base path (backend):** `/api/admin`  
**Frontend:** `/admin/` (React SPA)  
**Auth:** JWT. Login at `POST /api/admin/auth/login`. Pass token as `Authorization: Bearer <token>`.  
**Container:** `admin-api`  
**Internal port:** `8080`

A full-featured operations panel. Provides log viewing, deployment management, environment variable management with GitHub Secrets sync, per-server health checks, n8n workflow management, git-based backups, and an audit trail.

---

## Authentication

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/admin/auth/login` | None | Login. Body: `{ username, password }`. Returns JWT. |
| `GET` | `/api/admin/auth/me` | JWT | Current user info. |
| `POST` | `/api/admin/auth/change-password` | JWT | Change own password. |
| `GET` | `/api/admin/auth/users` | JWT (admin) | List all users. |
| `POST` | `/api/admin/auth/users` | JWT (admin) | Create user. Body: `{ username, password, is_admin, allowed_containers? }`. |
| `PATCH` | `/api/admin/auth/users/{id}` | JWT (admin) | Update user. |
| `DELETE` | `/api/admin/auth/users/{id}` | JWT (admin) | Delete user. |

A default admin user is seeded on first startup from `ADMIN_USERNAME` (default `admin`) and `ADMIN_PASSWORD`. Rate limiting is applied to login via `slowapi`.

**Container allowlists:** Set `allowed_containers` to a JSON array of container names to restrict which log streams a viewer-role user can see. `null` = unrestricted (admin only).

---

## Environment Variables

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/admin/env` | JWT (admin) | List all variables (values AES-decrypted on the fly). |
| `POST` | `/api/admin/env` | JWT (admin) | Create or update a variable. Body: `{ key, value }`. |
| `DELETE` | `/api/admin/env/{key}` | JWT (admin) | Delete a variable. |
| `GET` | `/api/admin/env/github-config` | JWT (admin) | Get current GitHub token/repo config. |
| `POST` | `/api/admin/env/github-config` | JWT (admin) | Set GitHub token and repo. |
| `GET` | `/api/admin/env/github-config/token` | JWT (admin) | Retrieve the stored GitHub token (decrypted). |

### Storage architecture

1. Variables are stored **AES-encrypted** (Fernet, keyed from SHA-256 of `JWT_SECRET`) in the SQLite `env_vars` table at `admin-api/data/`.
2. Variables are also written to the server's `.env` file on disk in plaintext.
3. If GitHub is configured, every save/delete also syncs the variable to a **GitHub Actions environment secret** (`production` environment). Values are encrypted with the repo's **NaCl public key** before being sent — GitHub never receives plaintext.

See [Settings — Environment tab](/docs/admin-panel/settings/) for the UI guide.

---

## Logs

Log viewing is built into `admin-api` via its own `logs/` module.

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/admin/logs/labels` | JWT | List container names in Loki (filtered by user's allowlist). |
| `GET` | `/api/admin/logs/query` | JWT | Query log lines. Params: `containers`, `search`, `level`, `range` (`15m`/`1h`/`6h`/`24h`). |
| `GET` | `/api/admin/logs/stats` | JWT | Log volume chart data. Params: `containers`, `range`. |
| `GET` | `/api/admin/logs/metrics` | JWT | Worker snapshots from Redis: CPU, active executions, running containers per server. |
| `GET` | `/api/admin/logs/audit` | JWT (admin) | Admin action audit log (paginated). |

Log data pipeline: container stdout → Promtail → Loki → `/logs/query` → frontend.

---

## Infrastructure

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/admin/infrastructure/servers/{server}/health` | JWT | Full 8-service health check for a server. |
| `POST` | `/api/admin/infrastructure/servers/{server}/restart/{container}` | JWT | Restart a named container on the given server via RemoteExecute. |

Health check probes (run in parallel, 3-second timeout each):
`n8n` · `postgres` · `redis` · `MinIO` · `media-api` · `nginx` · `Loki` · `Promtail`

Each returns: `{ name, status: "up" | "down", latency_ms, message }`.

The `server` parameter maps to a Redis key `worker-monitor:metrics:<server>`. The worker-monitor on each server reports its `media_api_url`, so the admin panel reaches the correct media-api for that server when running restarts.

---

## Backups

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/admin/backups` | JWT | Trigger immediate workflow backup (`backup_n8n_workflows.sh --force --commit`). |
| `GET` | `/api/admin/backups` | JWT | List past backup commits. Returns `[{ sha, message, date }]`. |
| `GET` | `/api/admin/backups/{sha}/details` | JWT | Show workflows in a specific backup commit. Returns `[{ name, active, archived }]`. |

Backups are git commits prefixed with `Backup:`. The nightly "Commit all workflows at 12 AM" n8n workflow creates these automatically. See [Backups](/docs/admin-panel/backups/) for the full guide.

---

## n8n Management

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/admin/n8n/stats` | JWT | n8n instance stats (workflow count, execution count). |
| `GET` | `/api/admin/n8n/workflows` | JWT | List all workflows with status and folder. |
| `GET` | `/api/admin/n8n/folders` | JWT | List workflow folders. |

---

## Health

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/admin/health` | None | Returns `{ status: "ok" }`. Used by Docker health checks and load balancers. |

---

## Frontend pages

| Page | Route | Description |
|---|---|---|
| Login | `/admin/login` | JWT login form |
| Dashboard | `/admin/` | Server metrics, quick stats |
| Logs | `/admin/logs` | Live container log viewer |
| Performance | `/admin/performance` | CPU, executions, containers over time |
| Infrastructure | `/admin/infrastructure` | Per-service health + container restart |
| Workflows | `/admin/workflows` | n8n workflow list and status |
| Backups | `/admin/backups` | Workflow backup history |
| Deployments | `/admin/deployments` | Deploy history and trigger |
| Reports | `/admin/reports` | Aggregated pipeline run reports |
| Settings | `/admin/settings` | Env vars, GitHub config, user management |
| Audit | `/admin/audit` | Admin action audit trail |
