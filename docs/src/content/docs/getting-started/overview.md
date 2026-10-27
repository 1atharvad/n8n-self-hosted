---
title: Project Overview
description: What this repo is and the three things a new developer touches most.
sidebar:
  order: 1
---

## What this repo is

An n8n workflow automation platform extended with:

- **Custom Python APIs** for media processing (TTS, video encoding, PowerPoint generation)
- **TypeScript custom nodes** that add missing capabilities to n8n (`JsonVariables`, `RemoteExecute`)
- **Admin panel** (React + FastAPI) for managing the deployment, viewing logs, and controlling environment variables — no SSH required
- **Log observability** through Loki + Promtail feeding into the admin panel
- **CI/CD** via GitHub Actions + Ansible

## The three things you'll touch most

### 1. `api/` — Media API (FastAPI / Python)

The n8n workflows call this for anything CPU-intensive: text-to-speech, PowerPoint generation, video encoding via FFmpeg, image extraction, and shell command execution. All heavy operations are async — the workflow submits a job, polls status, then retrieves the result.

See [Media API →](/docs/services/media-api/)

### 2. `n8n-workflows/` — Workflow JSON

Every workflow is version-controlled as JSON in `n8n-workflows/workflows/`. Pull from the live n8n instance with `npm run pull-workflows`; push local changes with `npm run push-workflows`.

See [Workflows →](/docs/n8n-workflows/overview/)

### 3. `custom-n8n-nodes/` — TypeScript nodes

Two custom nodes compiled from TypeScript and installed into n8n at startup. When you change them you must rebuild (`npm run build-n8n-nodes`) and restart n8n.

See [Custom Nodes →](/docs/custom-nodes/json-variables/)

## Tech stack

| Layer                   | Technology                   |
| ----------------------- | ---------------------------- |
| Workflow automation     | n8n (self-hosted)            |
| Media processing API    | FastAPI (Python 3.11)        |
| Admin panel             | FastAPI + React + TypeScript |
| Database                | PostgreSQL 15                |
| Cache / pub-sub         | Redis                        |
| Object storage          | MinIO                        |
| Log aggregation         | Loki + Promtail              |
| Reverse proxy           | Nginx (port 6060 in dev)     |
| Container orchestration | Docker Compose               |
| Provisioning & deploy   | Ansible + GitHub Actions     |
| Custom n8n nodes        | TypeScript                   |

## Next steps

- [Local Setup](/docs/getting-started/local-setup/) — get the stack running on your machine
- [Architecture Overview](/docs/architecture/overview/) — understand how all the pieces fit together
