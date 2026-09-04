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
2. The script calls the n8n API to export all workflows as JSON, writes them to `n8n-workflows/workflows/`, and runs `git add` + `git commit` with the message prefix `Backup:`.
3. The Backups page reads `git log` filtered to `Backup:` commits on the `n8n-workflows/` directory and shows them in reverse chronological order.

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

> `npm run push-workflows` reads local JSON files and upserts them into n8n via the API. Any workflows in the JSON that don't exist in n8n will be created; existing ones will be updated.

---

## API endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/admin/backups` | Trigger an immediate backup |
| `GET` | `/api/admin/backups` | List past backup commits |
| `GET` | `/api/admin/backups/{sha}/details` | Show workflows in a specific backup |
