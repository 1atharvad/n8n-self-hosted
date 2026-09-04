---
title: n8n Tables (public schema)
description: Overview of the tables n8n creates and manages in the PostgreSQL public schema.
sidebar:
  order: 4
---

n8n manages its own tables in the `public` schema of the PostgreSQL database. These are created and migrated **automatically by n8n on startup**. Do not modify them directly — n8n manages them through its own migration system.

---

## Key tables

| Table | Contents |
|---|---|
| `workflow_entity` | Workflow definitions as JSON blobs. One row per workflow. |
| `execution_entity` | Execution history: status, start/end times, output data, workflow ID. |
| `credentials_entity` | Encrypted credential definitions. The encryption key is `N8N_ENCRYPTION_KEY`. |
| `variables` | n8n Variables table (paid feature — not used in this stack). The `JsonVariables` custom node uses this table only when in workspace mode on a licensed instance. |
| `data_table` | n8n Data Tables (arbitrary structured data). Used by the `Get Global Data` utility workflow. |
| `tag_entity` | Workflow tags for organization. |
| `workflow_tag_entity` | Join table between workflows and tags. |
| `execution_metadata` | Extra metadata attached to executions. |
| `settings` | n8n instance settings (stored as key-value). |

---

## Important: don't modify these tables

n8n applies its own database migrations on startup. Manual schema changes (adding columns, indexes, renaming tables) will break n8n's migration system and may cause it to fail to start.

If you need to read data from n8n for reporting or debugging, use read-only queries. Never `INSERT`, `UPDATE`, or `DELETE` in these tables — use the n8n API or UI instead.

---

## `data_table` — used by this project

The `data_table` table is n8n's general-purpose data storage feature. This project uses it in the **Get Global Data in JSON Format From Data Tables** utility workflow to store global pipeline configuration (pages to scrape per source, video type, etc.).

The data is structured as JSON rows associated with a workflow ID. To edit the global config:
1. Open n8n → Data Tables (in the left sidebar or Settings).
2. Find the table used by the Get Global Data workflow.
3. Edit the values directly in the UI.

Changes take effect on the next workflow execution that calls the Get Global Data sub-workflow.

---

## Backing up n8n data

n8n data is stored in PostgreSQL. Back it up like any PostgreSQL database:

```bash
# Dump n8n's tables (inside the postgres container)
docker exec postgres pg_dump -U $POSTGRES_USER \
  --schema=public \
  --no-owner --no-acl \
  -d $POSTGRES_DB > n8n_backup.sql

# Restore
docker exec -i postgres psql -U $POSTGRES_USER -d $POSTGRES_DB < n8n_backup.sql
```

Workflow JSON is also backed up via git (see [Backups](/docs/admin-panel/backups/)) — that's usually sufficient for workflow recovery without needing a full DB restore.
