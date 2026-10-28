---
title: Manual Operations
description: SSH shortcuts, targeted container restarts, database migrations, and environment variable changes.
sidebar:
  order: 5
---

## Targeted container restarts

For quick fixes that don't need a full deploy (e.g. you changed a single service config):

**Via GitHub Actions:** Run the **Auto Deploy to Contabo** workflow manually with `services=<container-name>` (or the Bitbucket `deploy-services` custom pipeline if you use that CI instead).

**Via Admin Panel:** Go to **Infrastructure** → click **Restart** next to the container.

**Manually on the server:**
```bash
ssh root@<server-ip>
cd $DEPLOY_PATH
git pull
docker restart <container-name>
```

### Common container names

| Container        | Service                        |
| ---------------- | ------------------------------ |
| `n8n`            | n8n main instance              |
| `n8n-worker`     | n8n worker (multi-server only) |
| `media-api`      | Media processing FastAPI       |
| `admin-api`      | Admin panel                    |
| `worker-monitor` | CPU/metrics monitor            |
| `postgres`       | PostgreSQL                     |
| `redis`          | Redis                          |
| `nginx`          | Nginx reverse proxy            |
| `rustfs`         | RustFS object storage           |
| `loki`           | Loki log aggregation           |
| `promtail`       | Log shipper                    |

---

## Database migrations (manual)

Migrations run automatically on container startup via Alembic. If you're deploying to a server with an existing database for the first time:

```bash
# Skip initial migration on an existing DB with tables already present
docker exec media-api alembic stamp head

# Run any pending migrations after stamping
docker exec media-api alembic upgrade head

# Check current revision
docker exec media-api alembic current
```

---

## Viewing logs on the server

```bash
# All containers
docker compose logs -f

# Specific container, last 100 lines
docker logs --tail 100 -f n8n

# Container names in the running stack
docker ps --format '{{.Names}}'
```

Or use the [Admin Panel → Logs page](/docs/admin-panel/logs/) for a web UI with search and filtering.

---

## n8n workflow management

```bash
# Pull current workflows from running n8n into git
npm run pull-workflows

# Push local JSON files into the running n8n instance
npm run push-workflows

# Force pull (overwrite even if unchanged)
npm run pull-workflows:force

# Pull + auto git commit
npm run pull-workflows:commit
```

---

## Emergency: rebuild from scratch

If the server is in a bad state:

```bash
ssh root@<server-ip>
cd $DEPLOY_PATH

# Stop all containers
docker compose down

# Remove all data (DESTRUCTIVE — PostgreSQL and Redis data will be lost)
docker volume prune -f

# Start fresh
npm run docker:dev   # (or the appropriate prod compose command)
```

After a full data wipe, push workflows from git:
```bash
npm run push-workflows
```

And re-enter all n8n credentials (they cannot be recovered without the original `N8N_ENCRYPTION_KEY`).

---

## Checking disk usage

```bash
# Docker volumes
docker system df

# n8n_files/ contents
du -sh $DEPLOY_PATH/n8n_files/*/
```

The `n8n_files/` directory grows as videos accumulate. The **Cleanup & Reset Database** workflow deletes audio and video files at midnight. If disk is full unexpectedly, check for failed cleanup runs.
