---
title: Docker Compose Topologies
description: Which compose file to use for dev, single-server prod, and multi-server prod.
sidebar:
  order: 5
---

There are four Docker Compose files in `docker/`. The right one depends on whether you're developing locally or deploying to production, and whether production runs on one server or multiple.

## Topology table

| Mode                        | Compose file                     | Where it runs                 |
| --------------------------- | -------------------------------- | ----------------------------- |
| Development                 | `docker-compose.dev.yml`         | Local machine                 |
| Production — single server  | `docker-compose.prod.yml`        | One VPS                       |
| Production — main server    | `docker-compose.prod-main.yml`   | Main VPS in multi-server mode |
| Production — worker servers | `docker-compose.prod-worker.yml` | Each worker VPS               |

## Development (`docker-compose.dev.yml`)

Includes all services on one machine, but `n8n`, `n8n-worker`, `loki`, and `promtail` are gated
behind the `n8n` Compose profile — a plain `docker compose up` (i.e. `npm run docker:dev`) skips
them; pass `--profile n8n` (i.e. `npm run docker:dev:n8n`) to include them. Key differences from prod:
- Nginx port `6060:6060` exposed to host
- `frontend` container runs Vite dev server on `:5173` with HMR
- Source code is volume-mounted (Python API hot-reloads on save via `--reload`)
- `n8n-data/` and `n8n_files/` are bind-mounted from the host so you can inspect them

## Production — single server (`docker-compose.prod.yml`)

Everything on one machine, but:
- No dev server; frontend is static files built into the `admin-api` image
- No volume mounts of source code; images are pre-built
- Nginx may be omitted if aaPanel handles TLS termination at port 80/443

## Production — multi-server

Split across two types of machines:

### Main server (`docker-compose.prod-main.yml`)

Runs: `n8n`, `n8n-worker`, `worker-monitor`, `redis`, `postgres`, `nginx`, `rustfs`, `admin-api`, `frontend`, `docs`, `loki`, `promtail`

The main server holds all state (databases, Redis, Loki) and the n8n web UI. It also runs its own
`n8n-worker`, so it executes jobs from the shared Redis queue rather than only coordinating.

### Worker servers (`docker-compose.prod-worker.yml`)

Runs: `n8n-worker`, `worker-monitor`, `fastapi` (media-api), `promtail`

Workers do the heavy lifting — media processing and n8n workflow execution. They pull jobs from Redis on the main server and push logs to Loki on the main server.

## Switching topologies

Topology is controlled entirely by the `CONTABO_WORKER_IP` GitHub repository variable — **no code changes needed**:

| `CONTABO_WORKER_IP` | Mode                                                                             |
| ------------------- | -------------------------------------------------------------------------------- |
| empty / unset       | Single server — uses `docker-compose.prod.yml`                                   |
| `"1.2.3.4"`         | Multi-server — main uses `prod-main.yml`, that one worker uses `prod-worker.yml` |
| `"1.2.3.4,5.6.7.8"` | Multi-server — two workers                                                       |

See [Topology](/docs/deployment/topology/) for the full switching guide.

## Storage volumes

| Path              | Purpose                               | Shared?                                   |
| ----------------- | ------------------------------------- | ----------------------------------------- |
| `n8n_files/`      | Audio, video, PPT, PDF, images        | Yes — `n8n` + `media-api` both mount this |
| `n8n-data/`       | n8n internal data                     | No                                        |
| `postgres-data/`  | PostgreSQL data directory             | No                                        |
| `redis-data/`     | Redis persistence                     | No                                        |
| `minio-data/`     | MinIO object storage                  | No                                        |
| `loki-data/`      | Loki log storage                      | No                                        |
| `tts_cache/`      | Cached TTS audio files                | No                                        |
| `assets/`         | Static assets for PPT/video workflows | No                                        |
| `admin-api/data/` | Admin API SQLite database             | No                                        |
