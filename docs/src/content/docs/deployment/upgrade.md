---
title: Upgrade Guide
description: How to safely upgrade n8n, Python services, and system dependencies without losing data or credentials.
sidebar:
  order: 10
---

## Upgrading n8n

n8n releases frequently. Minor versions are generally safe. Major versions sometimes include breaking changes to workflow JSON, credentials, or the queue schema.

### Before you start

1. **Read the release notes** at [docs.n8n.io/release-notes/](https://docs.n8n.io/release-notes/) for the versions between your current version and the target. Look for:
   - Credential format changes (rare but require re-entering credentials)
   - Breaking changes to node behaviour
   - Database migration notes

2. **Check your current version:**
   ```bash
   docker exec n8n n8n --version
   ```

3. **Back up the database** before upgrading:
   ```bash
   # On the server
   docker exec postgres pg_dump -U $POSTGRES_USER $POSTGRES_DB > n8n_backup_$(date +%Y%m%d).sql
   ```

4. **Pull current workflows to git** so you have a snapshot:
   ```bash
   npm run pull-workflows:force-commit
   ```

### Upgrade steps

**Step 1 — Update the image tag**

n8n is pinned to `n8nio/n8n:latest` in all compose files. To pin to a specific version, edit the three files:
- `docker/docker-compose.dev.yml`
- `docker/docker-compose.prod.yml`
- `docker/docker-compose.prod-main.yml`

Change:
```yaml
image: n8nio/n8n:latest
```
To:
```yaml
image: n8nio/n8n:1.XX.Y
```

**Step 2 — Test in dev first**

```bash
# Pull the new image
docker pull n8nio/n8n:1.XX.Y

# Start dev stack
npm run docker:dev

# Log in to n8n and verify workflows are intact
# Trigger the JNN pipeline manually and confirm it runs
```

**Step 3 — Deploy to production**

Push the compose file change to git. The GitHub Actions pipeline auto-deploys on push to `main`.

Alternatively, deploy manually:
```bash
ssh root@<server-ip>
cd $DEPLOY_PATH
git pull
docker compose -f docker/docker-compose.prod.yml pull n8n n8n-worker
docker compose -f docker/docker-compose.prod.yml up -d n8n n8n-worker
```

**Step 4 — Verify**

```bash
# Confirm new version is running
docker exec n8n n8n --version

# Check logs for migration errors
docker logs --tail 100 n8n | grep -i "migration\|error\|warn"

# Confirm queue is healthy (workers picking up jobs)
docker exec redis redis-cli LLEN bull:jobs:wait
```

### Rollback

If the upgrade breaks something:

```bash
# Switch back to previous image tag in compose files, then:
docker compose -f docker/docker-compose.prod.yml up -d n8n n8n-worker

# If DB migration ran and needs to be reversed, restore from backup:
docker exec -i postgres psql -U $POSTGRES_USER $POSTGRES_DB < n8n_backup_YYYYMMDD.sql
```

---

## Upgrading the Media API (FastAPI)

The Media API is built from the local `api/` directory — there is no image to pull. Upgrades mean changing Python package versions in `api/requirements.txt`.

```bash
# After changing requirements.txt, rebuild the container
docker compose -f docker/docker-compose.dev.yml build fastapi
npm run docker:up:dev

# On production, GitHub Actions rebuilds automatically on push
# Or manually:
docker compose -f docker/docker-compose.prod.yml build fastapi
docker compose -f docker/docker-compose.prod.yml up -d fastapi
```

After upgrading packages, run any pending Alembic migrations:
```bash
docker exec media-api alembic upgrade head
```

---

## Upgrading the Admin API

Same as the Media API — built from `admin-api/`. Rebuild after dependency changes:

```bash
docker compose -f docker/docker-compose.prod.yml build admin-api
docker compose -f docker/docker-compose.prod.yml up -d admin-api
```

---

## Upgrading Nginx

```bash
# Pull latest nginx:alpine
docker pull nginx:alpine

# Recreate the container
docker compose -f docker/docker-compose.prod.yml up -d nginx
```

nginx is stateless — no data at risk. Config is mounted from the repo.

---

## Upgrading PostgreSQL

PostgreSQL major version upgrades (e.g. 15 → 16) require a data migration. **Do not simply change the image tag** — the data directory format is not backward-compatible.

For a major version upgrade:

1. Dump the full database:
   ```bash
   docker exec postgres pg_dumpall -U $POSTGRES_USER > full_dump_$(date +%Y%m%d).sql
   ```
2. Stop all services.
3. Change the image tag in all compose files.
4. Rename or move the old `postgres-data/` directory.
5. Start the new PostgreSQL container (it initialises a fresh data directory).
6. Restore:
   ```bash
   docker exec -i postgres psql -U $POSTGRES_USER < full_dump_YYYYMMDD.sql
   ```
7. Restart all services.

Minor version upgrades (e.g. 15.3 → 15.6) are safe — just pull and recreate.

---

## Rotating secrets

When rotating a secret (compromised key, staff change, periodic policy):

### Rotating `N8N_ENCRYPTION_KEY`

**This will break all saved n8n credentials.** Only do this if the key is compromised.

1. Export all credentials from n8n UI (note: values are not exported — you need the raw secrets).
2. Update `N8N_ENCRYPTION_KEY` in `.env`.
3. Restart n8n: `docker restart n8n`.
4. Re-enter all credentials in the n8n UI manually.

### Rotating `API_KEY` (Media API)

1. Update `API_KEY` in `.env`.
2. Update the **FastAPI Server** credential in n8n to match the new key.
3. Restart `media-api`: `docker restart media-api`.
4. Restart `admin-api` (it also reads `MEDIA_API_KEY`): `docker restart admin-api`.

### Rotating `JWT_SECRET` (Admin Panel)

1. Update `JWT_SECRET` in `.env`.
2. Restart `admin-api`: `docker restart admin-api`.
3. All active admin panel sessions are immediately invalidated — users must log in again.

### Rotating `POSTGRES_PASSWORD`

1. Connect to PostgreSQL and change the password:
   ```bash
   docker exec -it postgres psql -U $POSTGRES_USER -c "ALTER USER $POSTGRES_USER PASSWORD 'new-password';"
   ```
2. Update `POSTGRES_PASSWORD` in `.env`.
3. Restart all dependent containers: `docker restart n8n n8n-worker media-api admin-api`.
