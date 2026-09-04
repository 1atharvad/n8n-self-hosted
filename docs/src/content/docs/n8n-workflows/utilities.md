---
title: Utility Workflows
description: Nightly workflow backup, global config sub-workflow, and a job ingestion webhook.
sidebar:
  order: 6
---

Utility workflows that run at the root level (outside any folder) — shared infrastructure used by other workflows or run on a schedule.

---

## Commit all workflows at 12 AM

**ID:** `GA1jepVVDQcboMKO` | **Active:** yes | **Trigger:** Cron (midnight)

Backs up all n8n workflow JSON files to the git repository every night at midnight.

**How it works:**
1. Uses the **RemoteExecute** custom node to call `POST /execute` on the Media API.
2. The script runs `backup_n8n_workflows.sh --force --commit` via bash.
3. The shell script calls the n8n API to export all workflows as JSON, writes them to `n8n-workflows/workflows/`, then runs `git add` + `git commit` with a `Backup:` prefix message.

This is what creates the backup commits visible in Admin Panel → Backups.

**Credentials used:** FastAPI Server (RemoteExecute)

---

## Get Global Data in JSON Format From Data Tables

**ID:** `7x2kP8hsfNCvf5dY` | **Active:** yes | **Trigger:** Called by other workflows

A sub-workflow that reads shared configuration variables from n8n **Data Tables** and returns them as a JSON object. Other workflows call this at startup to get global config without hardcoding values.

**Why this exists:** Hardcoding config values inside individual workflows makes them painful to update across 34+ workflows. n8n Variables is a paid feature not available in self-hosted community edition. Instead, this stack stores shared config in a **Data Tables** table called `global variables` — this sub-workflow wraps that table read so any workflow can call it with `Execute Workflow` and receive the full config object in one step.

**Usage in other workflows:**
```
[Execute Workflow node]
  Workflow: "Get Global Data in JSON Format From Data Tables"
  → Returns: { google_api_key, google_cx, pages_to_scrape, ... }
```

The Job Scrapper and Script Generator use this to read the number of pages to scrape per source, the video type to use, and other pipeline-wide config that changes without a code deploy.

---

## Job Link Ingestion Webhook

**ID:** `vnfqKuTvB4RU2fCE` | **Active:** yes | **Trigger:** Webhook (POST)

A simple HTTP endpoint that inserts job listing rows directly into the `job_listing.job_links` PostgreSQL table. Acts as an alternative ingestion path — rather than scraping via the Job Scrapper workflow, external tools or scripts can push job data directly into the pipeline via this webhook.

**What it does:**
1. Receives a POST request with job data in the body.
2. Inserts the rows into `job_listing.job_links` via a PostgreSQL node.
3. Responds to the webhook with a success confirmation.

A disconnected `Execute a SQL query` node also exists in the workflow as a scratch node but is not wired into the main flow.

**Credentials used:** PostgreSQL
