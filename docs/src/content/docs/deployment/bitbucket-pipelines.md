---
title: Bitbucket Pipelines
description: Optional alternate CI — automatic pipeline on push, and custom pipelines for provisioning and targeted deploys.
sidebar:
  order: 4
---

This repo's own CI runs on [GitHub Actions](/docs/deployment/github-pipeline/). A
`bitbucket-pipelines.yml` is also included at the repo root for teams that host on Bitbucket and
want to use Bitbucket Pipelines instead — it mirrors the same lint/deploy/`deploy-services`
steps described here.

:::caution
The automatic pipeline below currently triggers on push to `devn8nversion2`, not `main` — check
`pipelines.branches` in `bitbucket-pipelines.yml` and update it to match whatever branch you
actually deploy from before relying on it.
:::

## Automatic pipeline — branch `devn8nversion2`

Every push to that branch triggers:

```
1. Lint frontend     (ESLint on admin-api/frontend/)
2. Lint API          (black + isort + ruff on api/)
3. Test              (Jest — custom n8n nodes)
4. Deploy            (Ansible deploy to all servers)
```

### Workflow-only shortcut

If the diff only touches `n8n-workflows/`, the deploy step is **skipped entirely** and a message
is printed. Use `npm run push-workflows` to deploy workflow-only changes directly to the n8n API
without a full container redeploy.

This saves ~5 minutes on every workflow-only commit.

---

## Custom pipelines

Run these from **Bitbucket → Pipelines → Run pipeline**.

| Pipeline | When to use |
|---|---|
| `setup-single` | First-time provision of a single server |
| `setup-multi` | First-time provision of all multi-server nodes |
| `deploy-services` | Targeted restart of specific containers without a full deploy |

### `setup-single` and `setup-multi`

Runs `ansible/playbooks/setup.yml` against the appropriate inventory. Use when:
- Provisioning a brand-new VPS
- Rebuilding a server from scratch
- Adding a new worker to a multi-server setup

See [Server Setup](/docs/getting-started/server-setup/) for what this playbook does.

### `deploy-services`

Prompts for a `services` variable. Pass a space-separated list of container names:

```
services = admin-api frontend
```

This runs `deploy_main.yml`/`deploy_workers.yml` in targeted restart mode — only the listed
containers are restarted, without taking down n8n or running migrations. Faster and less
disruptive than a full deploy.

Pass `all` (or leave blank) to do a full deploy.

---

## Linting locally

Run linters before pushing to catch failures early:

```bash
# Frontend only (ESLint)
npm run lint:admin

# Python API only (black + isort + ruff)
npm run lint:api
```

The Python linter uses the virtualenv at `api/venv/`. If you don't have it:

```bash
cd api
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

---

## Bitbucket repository variables used by the pipeline

| Variable | Description |
|---|---|
| `CONTABO_SSH_KEY` | Private SSH key for the pipeline to connect to all servers |
| `CONTABO_MAIN_IP` | Main server IP (read via `lookup('env', ...)` in the Ansible inventory) |
| `CONTABO_WORKER_IP` | Comma-separated worker IPs. Empty = single-server mode. |
| `DEPLOY_PATH` | Absolute path on the server (e.g. `/www/wwwroot/n8n.example.com`) |
| `GITHUB_REPO` | Repo slug used by `setup.yml` to clone the repo over SSH from GitHub |
| All `.env` variables | Injected into `.env` on the server during deploy (set as Secured variables) |

Mark all secret variables as **Secured** in Bitbucket settings — Secured variables are hidden
from pipeline logs and never exposed in build output.
