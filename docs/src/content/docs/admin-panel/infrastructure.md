---
title: Infrastructure Page
description: Per-service health checks and one-click container restarts without SSH.
sidebar:
  order: 3
---

**Route:** `/admin/infrastructure`

Shows live health status for all 8 services on each server, and lets you restart containers without SSH.

---

## Service health checks

The page runs a health check against all 8 services in parallel (3-second timeout each):

| Service | Health check |
|---|---|
| n8n | `GET http://n8n:5678/healthz` |
| PostgreSQL | TCP connection + simple query |
| Redis | `PING` command |
| MinIO | `GET http://minio:9000/minio/health/live` |
| media-api | `GET <media-api-url>/health` with `X-API-Key` header |
| nginx | `GET http://nginx:6060/` |
| Loki | `GET http://loki:3100/ready` |
| Promtail | `GET http://promtail:9080/ready` |

Each service shows:
- `up` or `down` status
- Latency in milliseconds
- HTTP status code or error message

Health checks refresh automatically every 30 seconds.

---

## Container restart

Click **Restart** next to any container to restart it on the given server without SSH.

**How it works:**
1. The admin panel calls `POST /api/admin/infrastructure/servers/{server}/restart/{container}`.
2. The admin-api looks up the `media_api_url` for that server from its Redis worker-monitor snapshot.
3. Admin-api sends `POST /execute` to that server's media-api with `{ command: "docker restart <container>" }`.
4. The media-api runs the command and returns the result.

Container names must match Docker compose service names exactly (e.g. `n8n`, `media-api`, `admin-api`).

---

## Multi-server mode

In multi-server mode, each server appears as a separate section. The `server` identifier maps to the `SERVER_ID` set in each server's `worker-monitor` env var (defaults to hostname).

The admin panel knows which server's media-api to reach by reading the `media_api_url` field from each server's Redis snapshot — no manual configuration needed.

---

## API endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/admin/infrastructure/servers/{server}/health` | Full 8-service health check for a server |
| `POST` | `/api/admin/infrastructure/servers/{server}/restart/{container}` | Restart a named container via RemoteExecute |
