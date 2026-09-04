# 🚀 N8N Self-Hosted Instance
> A powerful automation platform with custom media processing APIs, seamless integrations, and secure web access.

[![Website](https://img.shields.io/badge/Website-Live-brightgreen?style=for-the-badge&logo=render)](https://n8n.atharvadevasthali.com)
[![Docker](https://img.shields.io/badge/Docker-Containerized-blue?style=for-the-badge&logo=docker)](https://docker.com)

## 🌐 Live Access
**[N8N Platform](https://n8n.atharvadevasthali.com/)**
**[API Documentation](https://n8n.atharvadevasthali.com/api/docs)**

## 🛠️ Tech Stack

### Core Platform
![N8N](https://img.shields.io/badge/N8N-EA4B71?style=flat-square&logo=n8n&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Nginx](https://img.shields.io/badge/Nginx-009639?style=flat-square&logo=nginx&logoColor=white)

### Backend & APIs
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white)

### Infrastructure & DevOps
![Ansible](https://img.shields.io/badge/Ansible-EE0000?style=flat-square&logo=ansible&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-2088FF?style=flat-square&logo=githubactions&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-336791?style=flat-square&logo=postgresql&logoColor=white)

## ✨ Key Features

🎯 **Automation Excellence**
- Visual workflow builder with drag-and-drop interface
- 300+ pre-built integrations and custom nodes
- Background job processing for heavy tasks

🎨 **Media Processing Suite**
- Text-to-speech conversion with multiple voices
- PowerPoint generation from templates
- Image extraction and video processing
- MP4 combining with streaming support

🏗️ **Infrastructure**
- Docker Compose orchestration (single-server and multi-server)
- Ansible-based provisioning and deployment
- GitHub Actions CI/CD with lint gates and targeted container restarts
- Nginx reverse proxy for secure access
- Admin panel for environment variable and deployment management

## 🚀 Local Development

```bash
# Clone repo
git clone https://github.com/1atharvad/n8n-self-hosted.git
cd n8n-self-hosted

# Install required npm packages
npm install

# Set up environment
cp .env.example .env
nano .env

# Setup files for n8n, installing custom nodes, adding required assets
sh sh_files/setup_n8n_files.sh --clear-init

# Start dev environment
npm run docker:dev

# Stop dev environment
npm run docker:down:dev
```

## 🖥️ Server Provisioning (first-time setup)

See the [Server Setup docs](https://n8n.atharvadevasthali.com/docs/getting-started/server-setup/) (or `docs/src/content/docs/getting-started/server-setup.md` in this repo) for the full step-by-step guide covering single-server, multi-server, adding workers, rollback, and SSH key management.

Quick summary:

```bash
# 1. Provision (installs Docker, Node.js, generates deploy key, clones the repo)
CONTABO_MAIN_IP="1.2.3.4" GITHUB_REPO="owner/repo" npm run ansible:setup:single

# 2. Add the printed deploy key to GitHub → Repository settings → Deploy keys
#    If the clone step failed because the key wasn't added yet, just re-run step 1 —
#    every task in setup.yml is idempotent, so it picks up where it left off.

# 3. First deploy (copies .env, starts containers)
CONTABO_MAIN_IP="1.2.3.4" npm run ansible:deploy:single
```

## 🔑 GitHub Repository Variables

### Required variables (GitHub → Repository settings → Secrets and variables → Actions)

| Variable            | Description                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| `CONTABO_SSH_KEY`   | Private SSH key for connecting to all servers — paste the full contents of `~/.ssh/id_ed25519` |
| `CONTABO_MAIN_IP`   | Main server IP                                                                                 |
| `CONTABO_WORKER_IP` | Comma-separated worker IPs — **if empty, single-server mode; if set, multi-server mode**       |
| `GITHUB_REPO`       | GitHub repo slug used by Ansible to clone the repo (e.g. `owner/repo-name`)                    |

### App secrets (injected into `.env` on deploy)

| Variable                                                                | Description                            |
| ----------------------------------------------------------------------- | -------------------------------------- |
| `JWT_SECRET`                                                            | Admin panel JWT signing secret         |
| `LOGS_ADMIN_PASSWORD`                                                   | Admin panel login password             |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` / `POSTGRES_PORT` | PostgreSQL credentials                 |
| `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` / `MINIO_BUCKET_NAME`         | MinIO credentials                      |
| `N8N_ENCRYPTION_KEY`                                                    | n8n data encryption key                |
| `N8N_BASIC_AUTH_USER` / `N8N_BASIC_AUTH_PASSWORD`                       | n8n basic auth                         |
| `N8N_API_KEY`                                                           | n8n API key (used internally)          |
| `API_KEY`                                                               | Media API key                          |
| `ADMIN_PASSWORD` / `ADMIN_SECRET_KEY`                                   | FastAPI admin credentials              |
| `INTERNAL_SECRET`                                                       | Internal service-to-service auth token |
| `WEBHOOK_TUNNEL_URL`                                                    | n8n webhook URL                        |
| `N8N_EDITOR_BASE_URL`                                                   | Public URL of the n8n instance         |
| `VUE_APP_URL_BASE_API`                                                  | Base API URL baked into the admin frontend build |

### Optional variables (have defaults)

| Variable                  | Default | Description                          |
| ------------------------- | ------- | ------------------------------------ |
| `LOGS_ADMIN_USERNAME`     | `admin` | Admin panel username                 |
| `ADMIN_USERNAME`          | `admin` | FastAPI admin username               |
| `JWT_EXPIRE_HOURS`        | `24`    | JWT token expiry                     |
| `CPU_GATE_THRESHOLD`      | `35`    | CPU % gate for API requests          |
| `SERVER_ID`               | `main`  | Server identifier for worker-monitor |
| `WORKER_MONITOR_POLL_SEC` | `30`    | Worker monitor poll interval         |

## 🚢 Deployment

### Topology — automatic detection

Topology is determined purely by GitHub secrets — no manual variable needed:

- **`CONTABO_WORKER_IP` is empty** → single server, runs `docker-compose.prod.yml`
- **`CONTABO_WORKER_IP` = `"1.2.3.4,5.6.7.8"`** → multi-server; main runs `prod-main.yml`, each IP in the list runs `prod-worker.yml`

To add a worker: append its IP to `CONTABO_WORKER_IP` and push. No other changes needed.

### Automatic (GitHub Actions)
Every push to `main` triggers the CI/CD pipeline:
1. **Lint** — frontend ESLint + Python black/isort/ruff
2. **Deploy** — full Ansible deploy (skipped if only `n8n-workflows/` changed)

### Manual
```bash
# Single server
npm run ansible:deploy:single

# Multi-server (generates worker inventory from CONTABO_WORKER_IP)
CONTABO_WORKER_IP="1.2.3.4,5.6.7.8" npm run ansible:deploy:multi

# Rollback
npm run ansible:rollback:single
CONTABO_WORKER_IP="1.2.3.4,5.6.7.8" npm run ansible:rollback:multi
```

### Deployment Topologies

| Topology          | Compose file                     | Services                                                                                        |
| ----------------- | --------------------------------- | ------------------------------------------------------------------------------------------------ |
| `single`          | `docker-compose.prod.yml`        | Everything on one server                                                                        |
| `multi` — main    | `docker-compose.prod-main.yml`   | n8n, worker-monitor, redis, postgres, nginx, minio, admin-api, frontend, docs, loki, promtail    |
| `multi` — workers | `docker-compose.prod-worker.yml` | n8n-worker, worker-monitor, fastapi, promtail                                                   |

### Targeted restarts (manual / custom pipeline)

Run the **Auto Deploy to Contabo** workflow manually (`workflow_dispatch`) in GitHub Actions to deploy only specific containers without a full redeploy. Pass a `services` input (e.g. `admin-api frontend`) to limit which containers are restarted; leave it as `all` (or empty) for a full deploy.

> A `bitbucket-pipelines.yml` is also included for teams that prefer Bitbucket Pipelines instead of GitHub Actions — it mirrors the same lint/deploy/`deploy-services` steps. This repo's own CI runs on GitHub Actions.

## 📁 Project Structure

```
├── admin-api/                      # Admin panel (FastAPI + React)
├── api/                            # Media processing FastAPI service
├── ansible/
│   ├── inventory/
│   │   ├── single.yml              # Single-server inventory
│   │   └── multi/
│   │       ├── main.yml            # Main server inventory
│   │       └── workers_dynamic.yml # Generated at deploy time from CONTABO_WORKER_IP
│   └── playbooks/
│       ├── setup.yml               # First-time server provisioning
│       ├── deploy_main.yml         # Deploy main server
│       ├── deploy_workers.yml      # Deploy worker servers
│       └── rollback.yml            # Rollback to previous commit
├── docker/                         # Docker Compose files
├── docs/                           # Astro docs site (served at /docs)
├── nginx/                          # Nginx configuration
├── custom-n8n-nodes/               # TypeScript custom n8n nodes
├── processes/                      # Worker monitor service
├── sh_files/                       # Shell utility scripts
├── assets/                         # Static templates/media used by media API
├── cloudflared/                    # Cloudflare Tunnel config (dev only)
├── n8n_files/                      # Runtime files (audio, video, ppt, pdf)
└── .env                            # Environment variables
```

## 📋 Available Scripts

```bash
# Development
npm run docker:dev              # Full dev cycle (down + up)
npm run docker:dev:n8n          # Full dev cycle with n8n profile (wipes loki-data, down + up)
npm run docker:up:dev           # Start dev containers
npm run docker:down:dev         # Stop dev containers
npm run docker-rm-cache         # Prune all Docker cache

# Production
npm run docker:prod             # Full prod cycle (wipes loki-data, down + up)
npm run docker:prod:main        # Full prod-main cycle (wipes loki-data, down + up)
npm run docker:prod:worker      # Full prod-worker cycle (down + up)

# Docs site
npm run docs:dev                # Run docs site locally
npm run docs:build              # Build docs site
npm run docs:preview            # Preview built docs site

# Linting
npm run lint:admin              # ESLint on admin-api frontend
npm run lint:api                # black + isort + ruff on Python API

# Ansible
npm run ansible:setup:single    # Provision single server
npm run ansible:setup:multi     # Provision all multi servers
npm run ansible:deploy:single   # Deploy to single server
npm run ansible:deploy:multi    # Generate worker inventory + deploy to all multi servers
npm run ansible:rollback:single # Rollback single server
npm run ansible:rollback:multi  # Rollback all multi servers

# Workflows
npm run pull-workflows          # Pull workflows from n8n → git
npm run push-workflows          # Push local workflows → n8n
```

## 🔌 API Endpoints

### 🎵 Text-to-Speech
- `POST /vtt-generate-audio-bytes` - Generate TTS audio
- `GET /vtt-status/{job_id}` - Check job status
- `GET /vtt-result/{job_id}` - Download audio file

### 📊 PowerPoint Processing
- `POST /ppt-generator` - Generate PPT from template
- `GET /ppt/{file_name}` - Download PPT file
- `POST /extract-slides` - Extract slides as images (async)
- `GET /img-ext-status/{job_id}` - Check extraction status
- `GET /img-ext-result/{job_id}` - Get extraction result

### 🎬 Video Operations
- `POST /convert-to-mp4` - Image + audio to MP4 (async)
- `GET /convert-to-mp4-status/{job_id}` - Check conversion status
- `POST /convert-mp4-to-mp4` - Re-encode an existing MP4
- `POST /combine-videos` - Combine multiple videos
- `GET /combine-videos-status/{job_id}` - Check combine status
- `GET /combine-videos-result/{job_id}` - Get combine result

### 📁 File Management
> All endpoints require `X-API-Key` header.
- `POST /execute` - Run a whitelisted shell command or script on the host

### 🧑‍💻 Job Scraper
- `POST /job-scrape/linkedin` - Scrape LinkedIn job listings (async)
- `POST /job-scrape/indeed` - Scrape Indeed job listings (async)
- `GET /job-scrape-status/{job_id}` - Check scrape job status
- `GET /job-scrape-result/{job_id}` - Get scrape job result

### ⚙️ CPU Gate
- `GET /cpu-gate` - Get current CPU EMA sample
- `GET /cpu-gate/wait` - Block until CPU drops below threshold (or timeout)
- `GET /cpu-gate/reset` - Reset the local EMA fallback state

## 🏛️ Infrastructure Notes

### Database
- **Alembic migrations** run automatically on container startup
- On first deploy to an existing database, stamp to skip initial migration:
  ```bash
  docker exec media-api alembic stamp head
  docker exec admin-api alembic stamp head
  ```

### Adding environment variables
Manage env vars through the **Admin Panel** → Environment tab. Changes trigger an automatic full deploy via GitHub Actions.

## ⚙️ Worker Monitor

The `worker-monitor` container polls host CPU, the n8n execution API, and running Docker containers, then pushes a snapshot to Redis. The admin dashboard reads these snapshots to display live server metrics.

### Algorithm: Asymmetric EWMA

CPU is smoothed using an asymmetric EWMA — reacts fast to spikes, decays slowly after:

```
if cpu_raw > cpu_ema:
    cpu_ema = α_up   × cpu_raw + (1 − α_up)   × cpu_ema
else:
    cpu_ema = α_down × cpu_raw + (1 − α_down) × cpu_ema
```

Defaults: `α_up = 0.5`, `α_down = 0.1`.

### Configuration

| Variable             | Default  | Description                                   |
| -------------------- | -------- | --------------------------------------------- |
| `POLL_INTERVAL_SEC`  | `30`     | Seconds between snapshots                     |
| `EWMA_ALPHA_UP`      | `0.5`    | EMA weight when CPU is rising                 |
| `EWMA_ALPHA_DOWN`    | `0.1`    | EMA weight when CPU is falling                |
| `CPU_GATE_THRESHOLD` | `35`     | CPU % threshold included in snapshot          |
| `N8N_API_KEY`        | —        | Required for API-based active execution count |
| `SERVER_ID`          | hostname | Stable server identity shown in dashboard     |

---

<div align="center">

**Built with ❤️ by Atharva Devasthali**

*Automation Engineer | Full-Stack Developer | DevOps Enthusiast*

</div>
