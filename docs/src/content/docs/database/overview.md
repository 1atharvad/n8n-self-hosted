---
title: Database Overview
description: Which databases exist, who owns them, and how to connect.
sidebar:
  order: 1
---

The project uses **PostgreSQL** as the primary database and **SQLite** as a separate store for the admin panel.

---

## Databases at a glance

| Database | Type | Owner | Purpose |
|---|---|---|---|
| `public` schema | PostgreSQL | n8n | n8n's internal tables (workflows, executions, credentials) |
| `job_listing` schema | PostgreSQL | Media API (`api/`) | Job scraping pipeline data |
| `admin-api/data/` | SQLite | Admin API | Users, env vars, app config, audit log |

---

## PostgreSQL connection

All services connect to the same PostgreSQL container (`postgres:15`).

| Variable | Description |
|---|---|
| `POSTGRES_HOST` | `postgres` (Docker container name) |
| `POSTGRES_PORT` | `5432` |
| `POSTGRES_DB` | Database name (e.g. `n8n`) |
| `POSTGRES_USER` | Database user |
| `POSTGRES_PASSWORD` | Database password |

Connect from the server:
```bash
docker exec -it postgres psql -U $POSTGRES_USER -d $POSTGRES_DB
```

---

## Schema isolation

n8n and Media API share the same PostgreSQL database but use **separate schemas** to prevent table name collisions:

- n8n creates its tables in the `public` schema automatically.
- Media API creates `job_listing` schema and its tables via Alembic migrations.

Neither service needs to know about the other's tables.

---

## Further reading

- [job_listing Schema](/docs/database/job-listing-schema/) — `job_links` and `mp4_list` tables
- [Admin SQLite](/docs/database/admin-sqlite/) — `users`, `env_vars`, `app_config`, `audit_log`
- [n8n Tables](/docs/database/n8n-tables/) — what n8n creates in `public`
- [Alembic Migrations](/docs/database/migrations/) — how Media API schema changes are managed
- [Useful Queries](/docs/database/queries/) — queries for monitoring the pipeline
