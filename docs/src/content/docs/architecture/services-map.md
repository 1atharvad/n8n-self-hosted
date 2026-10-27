---
title: Component Map
description: Detailed service dependency diagram with all inter-service connections.
sidebar:
  order: 2
---

Full component map showing every inter-service connection, storage dependency, and network boundary.

**Request routing** — how traffic flows from browser to service:

```mermaid
graph TD
    Browser(["Browser"]) -->|":6060"| Nginx["Nginx\n6060 dev / 80-443 prod"]
    Nginx -->|"/"| n8n["n8n  :5678"]
    Nginx -->|"/api/core/"| MediaAPI["Media API  :9374"]
    Nginx -->|"/api/admin/"| AdminAPI["Admin API  :8080"]
    Nginx -->|"/admin/"| Frontend["Frontend  :5173"]
    Nginx -->|"/minio/"| MinIO[("MinIO  :9001")]

    subgraph Workers["Worker Servers"]
        N8NWorker["n8n Worker"]
        MediaAPIW["Media API  :9374"]
    end
    N8NWorker -->|"pull jobs"| n8n

    classDef svc fill:#0d9488,color:#fff,stroke:#0f766e
    classDef store fill:#92400e,color:#fff,stroke:#78350f
    classDef ext fill:#1e3a8a,color:#fff,stroke:#1e40af
    classDef mon fill:#374151,color:#fff,stroke:#4b5563
    classDef proxy fill:#1e1b4b,color:#5eead4,stroke:#4338ca

    class n8n,MediaAPI,AdminAPI,Frontend svc
    class MinIO store
    class Browser ext
    class N8NWorker,MediaAPIW mon
    class Nginx proxy
```

**Data dependencies** — which service reads/writes which store:

```mermaid
graph TD
    n8n["n8n"] --> PG[("PostgreSQL  :5432")]
    n8n --> Redis[("Redis  :6379")]
    n8n --> SharedVol[("n8n_files/\nshared volume")]

    MediaAPI["Media API"] --> PG
    MediaAPI --> MinIO[("MinIO  :9001")]
    MediaAPI --> SharedVol

    AdminAPI["Admin API"] --> PG
    AdminAPI --> Redis
    AdminAPI --> Loki[("Loki  :3100")]
    AdminAPI --> SQLite[("SQLite")]

    WorkerMon["Worker Monitor"] -->|"snapshot"| Redis
    Promtail["Promtail"] -->|"push"| Loki

    subgraph Workers["Worker Servers"]
        N8NWorker["n8n Worker"] -->|"pull jobs"| Redis
        PromtailW["Promtail"] --> Loki
        WorkerMonW["Worker Monitor"] --> Redis
    end

    classDef svc fill:#0d9488,color:#fff,stroke:#0f766e
    classDef db fill:#065f46,color:#fff,stroke:#047857
    classDef store fill:#92400e,color:#fff,stroke:#78350f
    classDef mon fill:#374151,color:#fff,stroke:#4b5563

    class n8n,MediaAPI,AdminAPI svc
    class PG,Redis,Loki,SQLite db
    class MinIO,SharedVol store
    class WorkerMon,Promtail,N8NWorker,PromtailW,WorkerMonW mon
```

## Port reference

| Service | Container | Internal port | External path |
|---|---|---|---|
| n8n | `n8n` | 5678 | `/` |
| Media API | `media-api` | 9374 | `/api/core/` |
| Admin API | `admin-api` | 8080 | `/api/admin/` |
| Admin frontend | `frontend` | 5173 (dev) | `/admin/` |
| MinIO console | `minio` | 9001 | `/minio/` |
| PostgreSQL | `postgres` | 5432 | internal only |
| Redis | `redis` | 6379 | internal only |
| Loki | `loki` | 3100 | internal only |
| Nginx | `nginx` | 6060 | exposed to host |

> The `logs-api/` directory contains a standalone FastAPI app but is **not deployed** as a separate container. Log viewing and worker metrics are served by `admin-api` through its own `logs/` module.
