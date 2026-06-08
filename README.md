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
![Cloudflare](https://img.shields.io/badge/Cloudflare-F38020?style=flat-square&logo=cloudflare&logoColor=white)
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
- Nginx reverse proxy + Cloudflare Tunnel for secure access
- Admin panel for environment variable and deployment management

## 🚀 Local Development

```bash
# Clone repo
git clone https://github.com/1atharvad/n8n-self-hosted.git
cd n8n-self-hosted

# Install dependencies
npm install

# Set up environment
cp .env.example .env
nano .env

# Start dev environment
npm run docker:dev

# Stop dev environment
npm run docker-down:dev
```

## 🖥️ Server Provisioning (first-time setup)

Requires Ansible installed locally (`pip install ansible`).

```bash
# Provision a single server
npm run ansible:setup:single

# Provision multi-server (main + workers)
npm run ansible:setup:multi
```

This installs Docker, Node.js, clones the repo, generates a GitHub deploy key, and sets up SSH access.

After running, copy the printed deploy public key and add it to **GitHub → Settings → Deploy keys** (read-only). Then re-run with `--tags clone` to finish the repo clone:

```bash
ansible-playbook -i ansible/inventory/single.yml ansible/playbooks/setup.yml --tags clone
```

## 🔑 GitHub Secrets & Variables

### Required secrets (GitHub → Settings → Secrets)

| Secret | Description |
|---|---|
| `CONTABO_SSH_KEY` | Private SSH key for connecting to all servers |
| `CONTABO_MAIN_IP` | Main server IP |
| `CONTABO_WORKER_IP` | Comma-separated worker IPs — **if empty, single-server mode; if set, multi-server mode** |

### App secrets (injected into `.env` on deploy)

| Secret | Description |
|---|---|
| `JWT_SECRET` | Admin panel JWT signing secret |
| `LOGS_ADMIN_PASSWORD` | Admin panel login password |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` / `POSTGRES_PORT` | PostgreSQL credentials |
| `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` / `MINIO_BUCKET_NAME` | MinIO credentials |
| `N8N_ENCRYPTION_KEY` | n8n data encryption key |
| `N8N_BASIC_AUTH_USER` / `N8N_BASIC_AUTH_PASSWORD` | n8n basic auth |
| `N8N_API_KEY` | n8n API key (used internally) |
| `API_KEY` | Media API key |
| `ADMIN_PASSWORD` / `ADMIN_SECRET_KEY` | FastAPI admin credentials |
| `INTERNAL_SECRET` | Internal service-to-service auth token |
| `WEBHOOK_TUNNEL_URL` | n8n webhook URL (Cloudflare tunnel) |
| `N8N_EDITOR_BASE_URL` | Public URL of the n8n instance |

### Optional secrets (have defaults)

| Secret | Default | Description |
|---|---|---|
| `LOGS_ADMIN_USERNAME` | `admin` | Admin panel username |
| `ADMIN_USERNAME` | `admin` | FastAPI admin username |
| `JWT_EXPIRE_HOURS` | `24` | JWT token expiry |
| `CPU_GATE_THRESHOLD` | `35` | CPU % gate for API requests |
| `SERVER_ID` | `main` | Server identifier for worker-monitor |
| `WORKER_MONITOR_POLL_SEC` | `30` | Worker monitor poll interval |

## 🚢 Deployment

### Topology — automatic detection

Topology is determined purely by GitHub secrets — no manual variable needed:

- **`CONTABO_WORKER_IP` is empty** → single server, runs `docker-compose.prod.yml`
- **`CONTABO_WORKER_IP` = `"1.2.3.4,5.6.7.8"`** → multi-server; main runs `prod-main.yml`, each IP in the list runs `prod-worker.yml`

To add a worker: append its IP to `CONTABO_WORKER_IP` and push. No other changes needed.

### Automatic (GitHub Actions)
Every push to `main` triggers the CI/CD pipeline:
1. **Lint** — frontend ESLint + Python black/isort/ruff
2. **Deploy** — Ansible deploys only the affected containers based on changed paths

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

| Topology | Compose file | Services |
|---|---|---|
| `single` | `docker-compose.prod.yml` | Everything on one server |
| `multi` — main | `docker-compose.prod-main.yml` | n8n, postgres, redis, nginx, minio, admin-api, loki |
| `multi` — workers | `docker-compose.prod-worker.yml` | n8n-worker, fastapi, promtail |

### Path-based targeted restarts (push events)

| Changed path | Containers restarted |
|---|---|
| `admin-api/**` | `admin-api`, `frontend` (main) |
| `api/**` | `fastapi` (workers) |
| `processes/**` | `worker-monitor` (all) |
| `nginx/**` | `nginx` reload (main) |
| `docker/**`, `package*` | Full deploy (all) |

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
│       ├── deploy.yml              # Application deployment
│       └── rollback.yml            # Rollback to previous commit
├── docker/                         # Docker Compose files
├── nginx/                          # Nginx configuration
├── custom-n8n-nodes/               # TypeScript custom n8n nodes
├── processes/                      # Worker monitor service
├── sh_files/                       # Shell utility scripts
├── n8n_files/                      # Runtime files (audio, video, ppt, pdf)
└── .env                            # Environment variables
```

## 📋 Available Scripts

```bash
# Development
npm run docker:dev              # Full dev cycle (down + up)
npm run docker-up:dev           # Start dev containers
npm run docker-down:dev         # Stop dev containers
npm run docker-rm-cache         # Prune all Docker cache

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
- `POST /cleanup` - Delete contents of specified n8n_files folders
- `POST /copy-video` - Copy a video into its epoch subfolder

## 🏛️ Infrastructure Notes

### Database
- **Alembic migrations** run automatically on container startup
- On first deploy to an existing database, stamp to skip initial migration:
  ```bash
  docker exec media-api alembic stamp head
  docker exec logs-api alembic stamp head
  ```

### Adding environment variables
Manage env vars through the **Admin Panel** → Environment tab. Changes trigger an automatic full deploy via GitHub Actions.

## ⚙️ Worker Autoscaler

The `worker-autoscaler` container dynamically scales `n8n-worker` replicas based on host CPU and Redis queue depth.

### Algorithm: Asymmetric EWMA

```
if cpu_raw > cpu_ema:
    cpu_ema = α_up   × cpu_raw + (1 − α_up)   × cpu_ema   # reacts fast to spikes
else:
    cpu_ema = α_down × cpu_raw + (1 − α_down) × cpu_ema   # decays slowly after spike
```

Defaults: `α_up = 0.5`, `α_down = 0.1`.

### Scaling Rules

| Condition | Action |
|---|---|
| `waiting > 0` and `ema < 65%` and `raw < 65%` | Scale up +1 worker |
| `max(ema, raw) > 88%` and `workers > min` | Emergency scale down −1 worker |
| Queue idle for 120s and `workers > min` | Scale down −1 worker |

### Configuration

| Variable | Default | Description |
|---|---|---|
| `MIN_WORKERS` | 1 | Minimum workers always running |
| `MAX_WORKERS` | 4 | Maximum workers allowed |
| `CPU_SCALE_UP_MAX` | 65 | Scale up only if CPU below this % |
| `CPU_SCALE_DOWN_EMERGENCY` | 88 | Force remove worker if CPU above this % |
| `IDLE_BEFORE_SCALEDOWN_SEC` | 120 | Seconds idle before scaling down |
| `POLL_INTERVAL_SEC` | 30 | Seconds between checks |
| `COOLDOWN_SEC` | 90 | Minimum gap between scale actions |
| `EWMA_ALPHA_UP` | 0.5 | EMA weight when CPU is rising |
| `EWMA_ALPHA_DOWN` | 0.1 | EMA weight when CPU is falling |

---

<div align="center">

**Built with ❤️ by Atharva Devasthali**

*Automation Engineer | Full-Stack Developer | DevOps Enthusiast*

</div>
