---
title: Local Development Setup
description: Clone, configure, and run the full stack locally in five steps.
sidebar:
  order: 2
---

## Prerequisites

| Tool           | Minimum version | Notes                                                    |
| -------------- | --------------- | -------------------------------------------------------- |
| Docker Desktop | 24+             | Must be running before `npm run docker:dev`              |
| Node.js        | 18+             | Required for custom node builds and npm scripts          |
| npm            | 9+              | Bundled with Node.js                                     |
| Python         | 3.11            | Only needed if you're editing `api/` Python code locally |

---

## Step 1 — Clone

```bash
git clone https://github.com/1atharvad/n8n-self-hosted.git
cd n8n-self-hosted
```

---

## Step 2 — Install Node dependencies

```bash
npm install
```

This installs the build tooling for custom n8n nodes and all npm-based scripts.

---

## Step 3 — Create the `.env` file

```bash
cp .env.example .env
```

Open `.env` and fill in every value marked `REQUIRED`. Minimum required for local dev:

| Variable                  | Example / Notes                     |
| ------------------------- | ----------------------------------- |
| `POSTGRES_USER`           | `n8nuser`                           |
| `POSTGRES_PASSWORD`       | any string                          |
| `POSTGRES_DB`             | `n8n`                               |
| `POSTGRES_PORT`           | `5432`                              |
| `MINIO_ROOT_USER`         | `minioadmin`                        |
| `MINIO_ROOT_PASSWORD`     | any string (min 8 chars)            |
| `MINIO_BUCKET_NAME`       | `n8n-files`                         |
| `N8N_ENCRYPTION_KEY`      | run `openssl rand -hex 32`          |
| `N8N_BASIC_AUTH_USER`     | `admin`                             |
| `N8N_BASIC_AUTH_PASSWORD` | any string                          |
| `API_KEY`                 | any string — used for the Media API |
| `ADMIN_SECRET_KEY`        | run `openssl rand -hex 32`          |
| `ADMIN_PASSWORD`          | any string                          |
| `JWT_SECRET`              | run `openssl rand -hex 32`          |
| `INTERNAL_SECRET`         | any string                          |
| `WEBHOOK_TUNNEL_URL`      | `http://localhost:5678`             |
| `N8N_EDITOR_BASE_URL`     | `http://localhost:5678`             |

Optional variables have sensible defaults and can be left as-is for local work.

> **Keep `N8N_ENCRYPTION_KEY` safe.** All n8n credentials are encrypted with this key. If you lose it after deploying to production, all credentials must be re-entered.

---

## Step 4 — Start the stack

`n8n`, `n8n-worker`, `loki`, and `promtail` are gated behind the `n8n` Docker Compose profile, so
a plain `docker:dev` starts everything else (APIs, admin panel, docs, nginx) without n8n. To get a
working n8n instance too:

```bash
npm run docker:dev:n8n
```

This runs three things in order:
1. `docker:down:dev` — tears down any previously running dev containers.
2. Clears `loki-data/` to start logs fresh.
3. `docker:up:dev:n8n` — calls `setup_n8n_files.sh` (creates the `n8n_files/` directory tree), then builds and starts all containers, including the `n8n` profile.

The first build takes a few minutes while Docker pulls base images and builds the Python APIs.

---

## Step 5 — Verify

Open these in a browser once the containers are up:

| Service                  | URL                                 |
| ------------------------ | ----------------------------------- |
| n8n                      | http://localhost:6060               |
| Media API docs (Swagger) | http://localhost:6060/api/core/docs |
| Admin panel              | http://localhost:6060/admin         |
| RustFS console           | http://localhost:6060/rustfs        |

All services are routed through Nginx on port **6060**. See [Nginx Routing](/docs/architecture/nginx-routing/) for the full path map.

Log in to n8n with `N8N_BASIC_AUTH_USER` / `N8N_BASIC_AUTH_PASSWORD`.

---

## Common commands

```bash
# Start base stack (no n8n/loki/promtail)
npm run docker:dev

# Start full stack including n8n (full reset — removes containers and Loki data)
npm run docker:dev:n8n

# Start without resetting containers/Loki data
npm run docker:up:dev          # base stack
npm run docker:up:dev:n8n      # with n8n profile

# Stop without removing containers
npm run docker:down:dev

# Remove all Docker cache (forces full rebuild next time)
npm run docker-rm-cache
```

---

## Working on different parts

### Custom n8n nodes

```bash
# Build and copy into n8n-data/custom/
npm run build-n8n-nodes

# Restart n8n to load the new nodes
docker restart n8n

# Run tests
npm test
npm run test:watch
```

### Python APIs (`api/`)

```bash
# Lint (isort + black + ruff)
npm run lint:api

# Set up virtualenv if needed
cd api
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run Alembic migrations inside the container
docker exec media-api alembic upgrade head

# Generate a new migration after model changes
docker exec media-api alembic revision --autogenerate -m "description"
```

### Admin panel frontend

```bash
cd admin-api/frontend
npm install
npm run lint     # ESLint check
npm run build    # build static assets into admin-api/static/

# After build, restart admin-api to serve the new static files
docker restart admin-api
```

In dev, the frontend runs as a Vite dev server (`frontend` container on `:5173`) with hot reload — no restart needed for frontend changes.

### Syncing n8n workflows

```bash
# Pull current workflows from running n8n into git
npm run pull-workflows

# Push local JSON files into the running n8n instance
npm run push-workflows
```

---

## Adding environment variables

If you add a new variable to `.env`:

```bash
docker restart <container-name>
```

To see available container names:

```bash
docker ps --format '{{.Names}}'
```
