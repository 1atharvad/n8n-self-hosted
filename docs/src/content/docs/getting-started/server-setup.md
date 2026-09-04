---
title: Server Setup
description: First-time VPS provisioning for single and multi-server deployments.
sidebar:
  order: 3
---

First-time server provisioning is handled by Ansible. This repo's CI is GitHub Actions, which
deploys but does not run first-time setup — provisioning is a manual, one-time step you run
locally (or via the `setup-single`/`setup-multi` custom pipelines if you use the optional
Bitbucket Pipelines CI instead).

## Quick reference

### Single server

```bash
CI_SSH_PUBKEY="$(cat ~/.ssh/id_ed25519.pub)" \
  ansible-playbook -i ansible/inventory/single.yml ansible/playbooks/setup.yml
```

### Multi-server (main + workers)

```bash
CI_SSH_PUBKEY="$(cat ~/.ssh/id_ed25519.pub)" \
  ansible-playbook -i ansible/inventory/multi/ ansible/playbooks/setup.yml
```

## What `setup.yml` does

1. Installs apt dependencies (git, curl, ca-certificates)
2. Adds Docker GPG key and apt repository
3. Installs Docker CE + compose plugin
4. Enables Docker service
5. Installs Node.js 20 via NodeSource
6. Generates an ed25519 SSH keypair at `/root/.ssh/id_ed25519`
7. Adds `github.com` to `known_hosts`
8. Prints the deploy public key → **add this to GitHub → Repository settings → Deploy keys**
9. Clones the repo to `deploy_path`
10. Adds the CI public key to `authorized_keys`

## After provisioning

1. Add the printed deploy key to GitHub → Repository settings → Deploy keys (read-only is sufficient).
2. Copy `.env.example` to `.env` on the server and fill in production values.
3. Push to `main` — GitHub Actions will deploy automatically.

## Further reading

- [Ansible Playbooks](/docs/deployment/ansible-playbooks/) — step-by-step breakdown of every playbook
- [Topology (Single vs Multi)](/docs/deployment/topology/) — when to use which mode
- [GitHub Actions Pipeline](/docs/deployment/github-pipeline/) — what triggers what
- [Bitbucket Pipelines](/docs/deployment/bitbucket-pipelines/) — the optional alternate CI
