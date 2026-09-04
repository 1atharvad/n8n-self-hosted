---
title: Data Flows
description: Step-by-step data flow diagrams for workflow execution, log viewing, and worker health monitoring.
sidebar:
  order: 4
---

## Workflow execution (happy path)

A scheduled cron trigger kicks off the pipeline. n8n calls the Media API for heavy work; the workflow polls until complete, then retrieves the result file.

```mermaid
flowchart TD
    T(["Cron / Webhook"])

    T --> n8n["n8n\nworkflow engine"]
    n8n -->|"POST + X-API-Key\nstart job"| MediaAPI["Media API\nTTS / PPT / Video"]
    MediaAPI -->|"writes output file"| Vol[("n8n_files/\nshared volume")]
    n8n -->|"GET /status/{job_id}\npoll until completed"| MediaAPI
    n8n -->|"GET /result/{job_id}"| MediaAPI
    MediaAPI -->|"reads result file"| Vol
    n8n -->|"upload final output"| YT[("YouTube / MinIO")]

    classDef svc fill:#0d9488,color:#fff,stroke:#0f766e
    classDef store fill:#92400e,color:#fff,stroke:#78350f
    classDef ext fill:#1e3a8a,color:#fff,stroke:#1e40af
    classDef trig fill:#0e7490,color:#fff,stroke:#0c4a6e

    class n8n,MediaAPI svc
    class Vol store
    class YT ext
    class T trig
```

**Key detail:** The `n8n_files/` volume is shared between `media-api` and `n8n`. When the Media API writes an audio or video file, n8n can read it directly using the shared volume mount — no file transfer over HTTP needed for large files.

---

## Log pipeline

Container stdout is collected by Promtail, pushed to Loki, and queried by the Admin API when the Logs page is open.

```mermaid
flowchart TD
    Containers["Docker Containers\nstdout log streams"]
    Containers -->|"tail log files"| Promtail["Promtail\nlog shipper"]
    Promtail -->|"HTTP push\nLoki push API"| Loki[("Loki\nlog store  :3100")]
    Loki -->|"LogQL query"| AdminAPI["Admin API\n/api/admin/logs/query"]
    AdminAPI --> Frontend["Admin Panel\nLogs page"]

    classDef svc fill:#0d9488,color:#fff,stroke:#0f766e
    classDef db fill:#065f46,color:#fff,stroke:#047857
    classDef mon fill:#374151,color:#fff,stroke:#4b5563

    class AdminAPI,Frontend svc
    class Loki db
    class Containers,Promtail mon
```

**Promtail config:** Promtail runs on each server (main and workers) and ships logs for all containers on that server. In multi-server mode, worker Promtail instances push to the same central Loki instance on the main server.

---

## Worker health monitoring

`worker-monitor` runs as a lightweight Python daemon, polling system state every 30 seconds and writing a JSON snapshot to Redis. The Admin API reads these snapshots to populate the Dashboard and Performance pages.

```mermaid
flowchart TD
    WM["Worker Monitor\nprocesses/"]

    WM -->|"read /proc/stat"| CPU["Host CPU"]
    WM -->|"GET /api/v1/executions"| n8nAPI["n8n API"]
    WM -->|"docker ps"| Docker["Docker Daemon"]
    WM -->|"write JSON snapshot every 30s"| Redis[("Redis\nworker-monitor:metrics:SERVER_ID")]
    Redis -->|"read snapshot"| AdminAPI["Admin API\n/api/admin/logs/metrics"]
    AdminAPI --> Dashboard["Dashboard + Performance\nAdmin Panel pages"]

    classDef svc fill:#0d9488,color:#fff,stroke:#0f766e
    classDef db fill:#065f46,color:#fff,stroke:#047857
    classDef mon fill:#374151,color:#fff,stroke:#4b5563
    classDef sys fill:#1e3a8a,color:#fff,stroke:#1e40af

    class AdminAPI,Dashboard svc
    class Redis db
    class WM mon
    class CPU,Docker,n8nAPI sys
```

**Multi-server:** Each server runs its own `worker-monitor` writing to `worker-monitor:metrics:<SERVER_ID>`. The Admin API reads all keys matching that prefix and aggregates them into a per-server selector on the Performance page.

---

## Environment variable write flow

When you save a variable through the Admin Panel → Settings → Environment tab:

```mermaid
flowchart TD
    UI["Admin Panel\nSettings - Environment tab"]

    UI -->|"POST /api/admin/env\nsave variable"| AdminAPI["Admin API"]
    AdminAPI -->|"AES-encrypt + store"| SQLite[("SQLite\nenv_vars table")]
    AdminAPI -->|"write plaintext"| DotEnv[(".env file\non server disk")]
    AdminAPI -->|"NaCl-encrypt + push"| GitHub["GitHub Actions Secrets\nproduction environment"]

    classDef svc fill:#0d9488,color:#fff,stroke:#0f766e
    classDef db fill:#065f46,color:#fff,stroke:#047857
    classDef ext fill:#1e3a8a,color:#fff,stroke:#1e40af
    classDef store fill:#92400e,color:#fff,stroke:#78350f

    class UI,AdminAPI svc
    class SQLite db
    class DotEnv store
    class GitHub ext
```

Changes to `.env` take effect on the next container restart. The admin panel writes the file but does not automatically restart services.

---

## Container restart flow (via Admin Panel)

```mermaid
flowchart TD
    UI["Admin Panel\nInfrastructure page"]

    UI -->|"POST /api/admin/infrastructure\n/servers/{server}/restart/{container}"| AdminAPI["Admin API"]
    AdminAPI -->|"lookup media_api_url\nfor target server"| Redis[("Redis\nworker snapshots")]
    AdminAPI -->|"POST /execute\ndocker restart name"| MediaAPI["Media API\ntarget server"]
    MediaAPI -->|"shell: docker restart"| Container["Target Container"]

    classDef svc fill:#0d9488,color:#fff,stroke:#0f766e
    classDef db fill:#065f46,color:#fff,stroke:#047857
    classDef sys fill:#374151,color:#fff,stroke:#4b5563

    class UI,AdminAPI,MediaAPI svc
    class Redis db
    class Container sys
```

This is how the Admin Panel restarts containers without SSH. The `media_api_url` field in the worker-monitor Redis snapshot tells the admin-api which server's media-api to call for each server.
