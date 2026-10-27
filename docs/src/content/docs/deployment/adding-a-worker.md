---
title: Adding a Worker Server
description: Step-by-step guide to provisioning a new Contabo worker VPS, wiring its SSH access, and connecting it into the multi-server topology.
sidebar:
  order: 2.5
---

This walks through adding one new worker server to an existing deployment — from a bare Contabo VPS to a container pulling jobs off the queue. See [Topology](/docs/deployment/topology/) for what runs where once it's up.

## Prerequisites

- A main server already provisioned and deployed (single or multi mode).
- The new worker's Contabo VPS, with its IP address.
- Access to Bitbucket repo settings (to add the worker's deploy key and update `CONTABO_WORKER_IP`).

## Two SSH keypairs are involved — don't mix them up

This is the part that trips people up, so it's worth being explicit before starting:

| | **Connecting key** | **Deploy key** |
|---|---|---|
| What it's for | Lets *you* (or CI) SSH **into** a server as root | Lets *that server* clone the **private repo** from Bitbucket |
| Where it lives | `~/.ssh/id_ed25519` on your machine, and `CONTABO_SSH_KEY` in Bitbucket repo variables | `/root/.ssh/id_ed25519` — generated locally on each server |
| How many exist | **One**, shared across every server | **One per server** — main has its own, each worker has its own |
| Where the public half goes | Appended to `root`'s `authorized_keys` on every server (`setup.yml` does this via `CI_SSH_PUBKEY`) | Added to **Bitbucket → Repository settings → Access keys**, once per server |

In short: adding a new worker never means creating a new *connecting* key — the existing one already works everywhere once its public half is on the server. It does mean a new *deploy* key gets generated, and you register that one's public half in Bitbucket separately for each server.

**Important — the connecting key must be identical, byte-for-byte, on every server.** `CONTABO_SSH_KEY` is not necessarily *your personal* `~/.ssh/id_ed25519` — it's whatever dedicated keypair was originally set up for CI (someone may have generated a separate key just for this, unrelated to any individual's laptop key). What actually matters is: **the same public key that's in main's `authorized_keys` must also be in the worker's `authorized_keys`.** If you bootstrap a new worker using your own personal key instead of the one in `CONTABO_SSH_KEY`, you'll be able to SSH in manually — but the CI pipeline will still get `Permission denied (publickey)`, because it connects using `CONTABO_SSH_KEY`'s private key, which has no matching entry on that server.

Before assuming your personal key is the right one, get the actual key CI uses and add *that* to the worker:
```bash
# Save the exact CONTABO_SSH_KEY value from Bitbucket into a local file first, then:
chmod 600 /tmp/contabo_ci_key
ssh-keygen -y -f /tmp/contabo_ci_key        # prints its public key
ssh-copy-id -i <(ssh-keygen -y -f /tmp/contabo_ci_key) root@<worker-ip>
rm /tmp/contabo_ci_key                       # don't leave a private key lying around
```

## 1. Get the connecting key onto the new VPS

If CI (or you, using the same key as `CONTABO_SSH_KEY`) can already `ssh root@<worker-ip>` with no password prompt, skip this — the server already trusts the right key.

Otherwise, check you have the key that matches `CONTABO_SSH_KEY` locally — see the callout above if you're not sure it's the same as your personal `~/.ssh/id_ed25519`.

If you genuinely don't have a connecting key yet (first-ever setup, no `CONTABO_SSH_KEY` configured anywhere), generate one and use it consistently everywhere from here on: `ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519`.

Install it on the new VPS. Contabo emails a root password if you didn't upload a key at order time — use it once:
```bash
ssh-copy-id -i ~/.ssh/id_ed25519.pub root@<worker-ip>
```

Confirm it worked, using the same key CI will use:
```bash
ssh -i ~/.ssh/id_ed25519 root@<worker-ip>   # should log in with no password prompt
```

## 2. Provision the worker

Register the IP and run `setup.yml` against it. You can do this locally or let Bitbucket Pipelines do it — same playbook either way.

**Locally:**
```bash
export CONTABO_WORKER_IP="<worker-ip>"   # comma-separate if adding alongside existing workers
npm run ansible:gen-workers               # writes ansible/inventory/multi/workers_dynamic.yml (not committed to git)

CI_SSH_PUBKEY="$(cat ~/.ssh/id_ed25519.pub)" \
  ansible-playbook -i ansible/inventory/multi/workers_dynamic.yml ansible/playbooks/setup.yml
```

**Via CI/CD:**
1. Add the worker's IP to the `CONTABO_WORKER_IP` repo variable (comma-separated with any existing workers).
2. Confirm `CONTABO_SSH_KEY` is already set as a **secured** repo variable — it should be, since main already deploys through it. This is the *connecting* key from the table above; it's shared, so a new worker doesn't need a new one, as long as step 1 installed the matching public key on it.
3. **Bitbucket → Pipelines → Run pipeline** → select branch `devn8nversion2` → choose the custom pipeline **`setup-multi`** → Run.

This installs Docker + Node.js on the worker, and generates its own deploy keypair at `/root/.ssh/id_ed25519` on the server — printing the public half at the end (in your terminal locally, or in the pipeline log via CI).

## 3. Register the deploy key and finish the clone

Before cloning will work, that worker's deploy key needs to be trusted by Bitbucket.

Check whether a deploy key already exists on the server (e.g. it was set up before, or you're reusing an old server):
```bash
ssh root@<worker-ip> "ls -la /root/.ssh/id_ed25519* 2>/dev/null || echo 'no deploy key on server'"
```
If nothing's there, create it manually the same way `setup.yml` would (safe to do — its `force: false` means Ansible won't touch it once it exists):
```bash
ssh root@<worker-ip> "ssh-keygen -t ed25519 -f /root/.ssh/id_ed25519 -N '' -C 'deploy@<worker-hostname>'"
```

Print the public key and register it:
```bash
ssh root@<worker-ip> "cat /root/.ssh/id_ed25519.pub"
```
→ paste into **Bitbucket → Repository settings → Access keys** (read-only is enough).

Then finish the clone — locally:
```bash
ansible-playbook -i ansible/inventory/multi/workers_dynamic.yml ansible/playbooks/setup.yml --tags clone
```
or by re-running the **`setup-multi`** pipeline, which includes the clone step.

## 4. Connect the worker to main's Redis and Postgres

Workers don't run their own Redis or Postgres — `n8n-worker` needs to reach the ones on the **main** server for the job queue and database. This step is currently manual: `ansible/playbooks/group_vars/all.yml` writes the same `REDIS_HOST=redis` / `POSTGRES_HOST=postgres` into every server's `.env`, which only resolve inside main's own Docker network — they won't work from a worker on a different machine as-is. (`POSTGRES_HOST` drives both `n8n-worker`'s `DB_POSTGRESDB_HOST` and `fastapi`'s `POSTGRES_HOST` on a worker — see `docker-compose.prod-worker.yml`.)

To fix this on a new worker:

1. **Put both servers on a private network.** Contabo offers private networking between VPS instances in the same account/region — enable it for main and the worker. This keeps Redis/Postgres off the public internet.
2. **Publish the ports on main**, bound to the private interface only (edit `docker/docker-compose.prod-main.yml`):
   ```yaml
   redis:
     ports:
       - "<main-private-ip>:6379:6379"
   postgres:
     ports:
       - "<main-private-ip>:5432:5432"
   ```
3. **Point the worker's `.env` at main's private IP** — after Ansible appends its static config block, override the two values it just wrote:
   ```bash
   ssh root@<worker-ip> "sed -i 's/^REDIS_HOST=.*/REDIS_HOST=<main-private-ip>/; s/^POSTGRES_HOST=.*/POSTGRES_HOST=<main-private-ip>/' <deploy_path>/.env"
   ```
4. Re-run this override after every deploy, since `common_setup.yml` re-appends the group defaults each time — or, better, move it into a host-scoped `group_vars/workers.yml` override once you're adding workers regularly.

Skip this step if main and the worker are already on the same private LAN with those ports reachable by hostname.

## 5. Deploy to the new worker

**Locally:**
```bash
npm run ansible:deploy:multi
```

**Via CI/CD:** run the **`deploy-services`** custom pipeline (or just push to `devn8nversion2` once `CONTABO_WORKER_IP` is set — the automatic pipeline picks it up).

Either way, this deploys `docker-compose.prod-worker.yml` (running `n8n-worker`, `media-api`, `promtail`, `worker-monitor`) to every IP in `CONTABO_WORKER_IP`, including the new one.

## 6. Verify

- `docker compose -f docker/docker-compose.prod-worker.yml ps` on the worker — all containers should be `running`.
- Check the [Admin Panel → Infrastructure](/docs/admin-panel/infrastructure/) page — the new server should show up alongside main.
- Trigger a workflow execution and confirm it lands on the new worker via `worker-monitor` logs or the Loki logs shipped from that host.

## Related

- [Topology — Single vs Multi-Server](/docs/deployment/topology/)
- [Ansible Playbooks](/docs/deployment/ansible-playbooks/)
- [Server Setup](/docs/getting-started/server-setup/)
