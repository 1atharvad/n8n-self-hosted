---
title: Admin Panel Overview
description: What the admin panel is, how to log in, and a map of all pages.
sidebar:
  order: 1
---

The admin panel is a React SPA backed by FastAPI. It is the primary operations interface for managing the deployment, viewing logs, and controlling the environment — **no SSH required** for day-to-day work.

**URL:** `https://<your-domain>/admin/` (production) or `http://localhost:6060/admin/` (local dev)

---

## Logging in

Navigate to `/admin/login`. Use the credentials set by `ADMIN_USERNAME` (default: `admin`) and `ADMIN_PASSWORD`.

On successful login a JWT is issued and stored in the browser. It expires after `JWT_EXPIRE_HOURS` (default: 24 hours). You will be redirected to the login page when it expires.

---

## Page map

| Page | Route | What it does |
|---|---|---|
| Dashboard | `/admin/` | CPU, active executions, running containers at a glance |
| [Logs](/docs/admin-panel/logs/) | `/admin/logs` | Live container log viewer with search and filtering |
| Performance | `/admin/performance` | Time-series charts: CPU (raw + EWMA), executions, containers |
| [Infrastructure](/docs/admin-panel/infrastructure/) | `/admin/infrastructure` | Per-service health checks + one-click container restart |
| Workflows | `/admin/workflows` | Read-only view of all n8n workflows and their last execution |
| [Backups](/docs/admin-panel/backups/) | `/admin/backups` | Git-based workflow backup history + manual trigger |
| Deployments | `/admin/deployments` | Recent GitHub Actions runs; trigger targeted restarts |
| [Settings](/docs/admin-panel/settings/) | `/admin/settings` | Env vars, GitHub Secrets sync, user management |
| Audit Log | `/admin/audit` | Immutable record of all admin actions |
| Reports | `/admin/reports` | Aggregated pipeline run stats |

---

## Dashboard

**Route:** `/admin/`

Shows at a glance:
- Smoothed CPU percentage (EWMA from worker-monitor)
- Active n8n execution count
- Running container count
- Recent workflow activity

Data refreshes automatically from `/api/admin/logs/metrics`, which reads Redis snapshots written by `worker-monitor`. In multi-server mode, switch between servers using the server selector.

---

## Performance

**Route:** `/admin/performance`

Time-series charts showing:
- CPU (raw reading and EWMA-smoothed) over the last hour
- Active n8n execution count over time
- Running container count over time

In multi-server mode, a server selector lets you view metrics for each server separately.

---

## Workflows (read-only)

**Route:** `/admin/workflows`

Lists all n8n workflows fetched from the n8n API:
- Workflow name, folder, active/inactive status
- Last execution time and status

This is a **read-only view**. To edit workflows, open the n8n UI at `/`. To sync workflows to/from git, use the CLI scripts — see [Workflows](/docs/n8n-workflows/overview/).

---

## Audit Log

**Route:** `/admin/audit`

Every admin action is recorded in the `audit_log` SQLite table with:
- Actor username and ID
- Action type (`env_var.set`, `user.create`, `container.restart`, etc.)
- Target name (env var key, container name, username)
- Client IP address
- Timestamp (UTC)

Audit entries are **read-only** and cannot be deleted through the UI.

---

## Reports

**Route:** `/admin/reports`

Aggregated reports on video pipeline runs, execution counts, and error rates over time. Useful for monitoring the health of the JNN YouTube automation pipeline.
