---
title: Backups Page
description: Git-based workflow backup management — triggering, inspecting, and restoring backups.
sidebar:
  order: 5
---

**Route:** `/admin/backups`

Git-based workflow backup management. Every backup creates a git commit on the `n8n-workflows/` directory — no external storage needed.

---

## How backups work

1. The **"Commit all workflows at 12 AM"** n8n workflow runs `backup_n8n_workflows.sh --force --commit` every night at midnight.
2. The script runs `n8n export:workflow --all --separate` (via the n8n CLI inside the container) to dump every workflow as JSON into `n8n-workflows/workflows/`, injects folder info from Postgres, and dumps n8n Data Tables to `n8n-workflows/data/`.
3. It also runs `n8n export:credentials --all --separate` into `n8n-workflows/credentials/` — **encrypted** (never `--decrypted`), so the files are safe to commit but only importable on an instance with the same `N8N_ENCRYPTION_KEY`.
4. It runs `git add` + `git commit` with the message prefix `Backup:` on the whole `n8n-workflows/` directory (workflows, data, and credentials together).
5. The Backups page reads `git log` filtered to `Backup:` commits on the `n8n-workflows/` directory and shows them in reverse chronological order.

:::caution
Every credential must have a **unique name**. Restoring matches old credentials to their newly-assigned Postgres IDs by name (Postgres doesn't preserve ids on import — see below), so two credentials sharing a name will cause the remap to pick one arbitrarily.
:::

---

## Triggering a manual backup

Click **Run Backup Now** to immediately pull all workflows from n8n and commit them. Useful before making risky changes (e.g. before deleting a workflow or restructuring folders).

This calls `POST /api/admin/backups`.

---

## Inspecting a backup

Click any backup entry to see a list of all workflows captured at that point in time — name, active/inactive status, and archived status. This tells you exactly what was in the system at that snapshot.

This calls `GET /api/admin/backups/{sha}/details`.

---

## Restoring from a backup

Backups are git commits, so restoration is done via git on the server:

```bash
# SSH into the server
ssh root@<server-ip>
cd $DEPLOY_PATH

# Check out the workflow files at the desired commit
git checkout <sha> -- n8n-workflows/

# Push the restored JSON back to the running n8n instance
npm run push-workflows

# Un-detach the directory so future backups work normally
git checkout HEAD -- n8n-workflows/
```

> `npm run push-workflows` **wipes every existing workflow and folder in n8n**, then re-imports everything from the local JSON files, reassigns folders, and restores credentials and Data Tables from the same `n8n-workflows/` snapshot. It is not an upsert — anything in n8n that isn't in the JSON snapshot is deleted.
>
> On Postgres, both workflow and credential imports get assigned **new** ids instead of keeping the ones from the export. The script automatically remaps every stale `Execute Workflow` sub-workflow reference and every stale credential reference across all imported workflows afterward, matched by name — so sub-workflow links and credential bindings come back working without manual reselection, as long as names are unique.

---

## API endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/admin/backups` | Trigger an immediate backup |
| `GET` | `/api/admin/backups` | List past backup commits |
| `GET` | `/api/admin/backups/{sha}/details` | Show workflows in a specific backup |
