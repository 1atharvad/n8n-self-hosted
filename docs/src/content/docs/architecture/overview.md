---
title: Architecture Overview
description: High-level view of all system components and how they relate.
sidebar:
  order: 1
---

The platform is a collection of Docker containers sitting behind a single Nginx reverse proxy. All external traffic (browser, webhook calls, API calls) enters on one port and Nginx routes it to the right service.

## Traffic flow

```mermaid
graph TD
    Browser(["Browser / External"]) -->|":6060"| Nginx["Nginx\n6060 dev / 80-443 prod"]
    Nginx -->|"/"| n8n["n8n  :5678"]
    Nginx -->|"/api/core/"| MediaAPI["Media API  :9374"]
    Nginx -->|"/api/admin/"| AdminAPI["Admin API  :8080"]
    Nginx -->|"/admin/"| Frontend["Frontend  :5173"]

    subgraph Workers["Worker Servers"]
        N8NWorker["n8n Worker"]
        MediaAPIW["Media API  :9374"]
    end
    N8NWorker -->|"pull jobs via Redis"| n8n

    classDef svc fill:#0d9488,color:#fff,stroke:#0f766e
    classDef ext fill:#1e3a8a,color:#fff,stroke:#1e40af
    classDef mon fill:#374151,color:#fff,stroke:#4b5563
    classDef proxy fill:#1e1b4b,color:#5eead4,stroke:#4338ca

    class n8n,MediaAPI,AdminAPI,Frontend svc
    class Browser ext
    class N8NWorker,MediaAPIW mon
    class Nginx proxy
```

## Data stores

```mermaid
graph TD
    n8n["n8n"] --> PG[("PostgreSQL  :5432")]
    n8n --> Redis[("Redis  :6379")]

    MediaAPI["Media API"] --> PG
    MediaAPI --> MinIO[("MinIO  :9001")]

    AdminAPI["Admin API"] --> PG
    AdminAPI --> Redis
    AdminAPI -->|"LogQL"| Loki[("Loki  :3100")]

    WorkerMon["Worker Monitor"] -->|"snapshot"| Redis
    Promtail["Promtail"] -->|"push"| Loki

    classDef svc fill:#0d9488,color:#fff,stroke:#0f766e
    classDef db fill:#065f46,color:#fff,stroke:#047857
    classDef store fill:#92400e,color:#fff,stroke:#78350f
    classDef mon fill:#374151,color:#fff,stroke:#4b5563

    class n8n,MediaAPI,AdminAPI svc
    class PG,Redis,Loki db
    class MinIO store
    class WorkerMon,Promtail mon
```

## Service roles at a glance

| Service | Container | Role |
|---|---|---|
| **n8n** | `n8n` | Workflow automation engine. Executes all workflows. |
| **Media API** | `media-api` | FastAPI for CPU-intensive media work (TTS, video, PPT). |
| **Admin API** | `admin-api` | Operations panel backend (env vars, logs, health, backups). |
| **Frontend** | `frontend` (dev) | React SPA served by Vite in dev; static files in prod. |
| **Worker Monitor** | `worker-monitor` | Polls CPU/containers/executions; writes snapshots to Redis. |
| **PostgreSQL** | `postgres` | Primary database for n8n and Media API. |
| **Redis** | `redis` | n8n job queue (multi-server) + worker-monitor snapshots. |
| **RustFS** | `rustfs` | Object storage for video files. |
| **Loki** | `loki` | Log aggregation backend. |
| **Promtail** | `promtail` | Log shipper: reads container stdout → pushes to Loki. |
| **Nginx** | `nginx` | Reverse proxy. Single entry point for all traffic. |

## Key architectural decisions

**Single Nginx entry point** — all traffic, internal and external, goes through port 6060 (dev) or 80/443 (prod). This means service URLs are consistent regardless of which container you're connecting from: `/api/core/` always works.

**Async job pattern** — the Media API never blocks n8n. Every heavy operation (`POST /endpoint`) returns a `job_id` immediately. The workflow polls `/status/{id}` until `completed`, then downloads the result. This keeps n8n workflows non-blocking.

**PostgreSQL schema separation** — n8n owns `public`, Media API owns `job_listing`. They share the same PostgreSQL container but never collide.

**Redis dual role** — used as both a Bull job queue (n8n worker coordination in multi-server mode) and a metrics store (`worker-monitor` snapshot keys).

## More detail

- [Component Map](/docs/architecture/services-map/) — full Mermaid diagram with all connections
- [Nginx Routing](/docs/architecture/nginx-routing/) — path table and WebSocket headers
- [Data Flows](/docs/architecture/data-flows/) — workflow execution, log pipeline, worker health
- [Docker Compose Topologies](/docs/architecture/docker-compose/) — dev vs prod single vs prod multi
