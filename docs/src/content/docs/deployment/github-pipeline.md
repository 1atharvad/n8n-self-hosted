---
title: GitHub Actions Pipeline
description: The primary CI/CD pipeline — automatic lint + deploy on push, and manual targeted restarts.
sidebar:
  order: 3
---

This repo's CI/CD runs on **GitHub Actions** (`.github/workflows/deploy.yml`). A
[Bitbucket Pipelines](/docs/deployment/bitbucket-pipelines/) config is also included for teams
that prefer Bitbucket instead — it mirrors the same lint/deploy steps — but GitHub Actions is
what this repo's own CI actually runs.

## Automatic pipeline — branch `main`

Every push to `main` (except changes that only touch `n8n-workflows/`) triggers:

```
1. Lint frontend     (ESLint on admin-api/frontend/)
2. Lint API          (black + isort + ruff on api/)
3. Detect topology    (single vs multi, from CONTABO_WORKER_IP)
4. Deploy             (Ansible deploy to all servers)
```

### Workflow-only shortcut

If the diff only touches `n8n-workflows/`, the entire job is skipped (`paths-ignore` on the
workflow trigger) — no lint, no deploy. Use `npm run push-workflows` to deploy workflow-only
changes directly to the n8n API without a full container redeploy.

## Manual dispatch — targeted restarts

Run the **Auto Deploy to Contabo** workflow manually from the GitHub Actions tab
(`workflow_dispatch`) to restart specific containers without a full redeploy. Pass a `services`
input, space-separated:

```
services = admin-api frontend
```

Leave it as `all` (or empty) for a full deploy. This runs `deploy_main.yml`/`deploy_workers.yml`
in targeted restart mode — only the listed containers are restarted, without taking down n8n or
running migrations.

## Topology detection

Topology is inferred automatically from the `CONTABO_WORKER_IP` secret — empty means
single-server (`docker-compose.prod.yml`), set means multi-server
(`docker-compose.prod-main.yml` + `docker-compose.prod-worker.yml` per worker IP, with
`sh_files/gen_workers_inventory.sh` generating the dynamic worker inventory).

## Linting locally

Run linters before pushing to catch failures early:

```bash
# Frontend (ESLint)
npm run lint:admin

# Python API (black + isort + ruff)
npm run lint:api
```

The Python linter uses the virtualenv at `api/venv/`. If you don't have it:

```bash
cd api
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## GitHub repository variables used by the pipeline

| Variable | Description |
|---|---|
| `CONTABO_SSH_KEY` | Private SSH key for the pipeline to connect to all servers |
| `CONTABO_MAIN_IP` | Main server IP |
| `CONTABO_WORKER_IP` | Comma-separated worker IPs — empty = single-server mode |
| `GITHUB_REPO` | Repo slug (`owner/repo`) used by Ansible's `setup.yml` to clone over SSH |
| All `.env` variables | Injected into `.env` on the server during deploy (set as repository secrets/variables under Settings → Secrets and variables → Actions) |

Mark all secret values as **Secrets** (not Variables) in GitHub repository settings — secrets are
redacted from workflow logs, variables are not.
