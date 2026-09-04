---
title: Alembic Migrations
description: How to run, generate, and roll back database migrations for the Media API.
sidebar:
  order: 5
---

The Media API (`api/`) uses **Alembic** for schema migrations. Migrations live in `api/alembic/versions/` and run automatically when the `media-api` container starts.

---

## Common commands

```bash
# Run all pending migrations (runs automatically on startup)
docker exec media-api alembic upgrade head

# Check which revision the DB is at
docker exec media-api alembic current

# Show migration history
docker exec media-api alembic history

# Generate a new migration after changing a SQLAlchemy model
docker exec media-api alembic revision --autogenerate -m "short description"

# Rollback one migration
docker exec media-api alembic downgrade -1

# Rollback to a specific revision
docker exec media-api alembic downgrade <revision_id>

# Stamp head without running migrations (for existing DBs)
docker exec media-api alembic stamp head
```

---

## Migration history

| Revision | Description |
|---|---|
| `001` | Initial schema — creates `job_listing` schema, `job_links` and `mp4_list` tables |
| `002` | Adds `job_description` and `video_type` columns to `job_links` |

---

## Adding a new migration

1. Edit the SQLAlchemy model in `api/models.py` (or wherever the model lives).
2. Generate the migration:
   ```bash
   docker exec media-api alembic revision --autogenerate -m "add_new_column"
   ```
3. Review the generated file in `api/alembic/versions/`. Autogenerate is not perfect — check that the `upgrade()` and `downgrade()` functions look correct.
4. Apply it:
   ```bash
   docker exec media-api alembic upgrade head
   ```
5. Commit the migration file to git.

---

## First-time setup with an existing database

If you're deploying to a server where the `job_listing` tables already exist (created manually or by an old process), tell Alembic to skip the initial migration without trying to re-create the tables:

```bash
docker exec media-api alembic stamp head
```

This marks the database as being at the latest revision without running any migration steps. After stamping, Alembic will only run future migrations.

---

## Alembic configuration

Config lives in `api/alembic.ini` and `api/alembic/env.py`. The database URL is read from the `DATABASE_URL` environment variable (or assembled from `POSTGRES_*` variables in `env.py`).

The `job_listing` schema is created in the initial migration (`001`) with:
```sql
CREATE SCHEMA IF NOT EXISTS job_listing;
```

All tables in migration `001` are created under `job_listing.` prefix.
