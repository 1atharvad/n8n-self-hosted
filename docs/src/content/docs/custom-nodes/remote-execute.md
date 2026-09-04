---
title: RemoteExecute
description: Execute shell commands on the Media API server from n8n workflows without SSH.
sidebar:
  order: 2
---

**Node name in n8n:** `Remote Execute`  
**Internal name:** `remoteExecute`  
**Source:** `custom-n8n-nodes/RemoteExecute/RemoteExecute.node.ts`

Executes an arbitrary shell command on the Media API server via an HTTP call to `/api/core/execute`. This lets n8n workflows trigger file system operations, run shell scripts, and invoke CLI tools on the server without SSH.

---

## Where it's used

| Workflow | What it does |
|---|---|
| **Cleanup & Reset Database** | Deletes files from `n8n_files/` subdirectories |
| **Video Creation** | Moves/copies media files between directories |
| **Commit all workflows at 12 AM** | Runs `backup_n8n_workflows.sh --force --commit` |
| **Admin API — container restart** | Runs `docker restart <container>` (via the Admin API, not the node directly) |

---

## Required credential

Set up a `FastAPI Server API` credential in n8n:

| Field | Value |
|---|---|
| Base URL | `http://media-api:9374` (internal Docker network) or `http://localhost:6060/api/core` (local dev via Nginx) |
| API Key | Value of the `API_KEY` env var |

The credential is tested against `/health` when saved.

---

## Node parameters

| Parameter | Description |
|---|---|
| `Command` | Shell command to run. Supports n8n expressions. Example: `rm -rf /app/n8n_files/audio_files/{{ $json.epoch }}` |

---

## Response

Returns `{ stdout, stderr, returnCode }` for each item.

- `returnCode: 0` → success
- Non-zero `returnCode` → HTTP 500 from the Media API → n8n treats as an error

---

## How it works under the hood

The node sends `POST /api/core/execute` with `{ command: "<your command>" }`. The Media API validates the command against its security model and runs it as a subprocess.

The `/execute` endpoint has an extensive blocklist (recursive deletes outside allowed dirs, disk writes to critical paths, `sudo`, download-and-execute, fork bombs, etc.). See [Media API — Execute endpoint](/docs/services/media-api/#execute-shell-command-relay) for the full security model.

---

## Security note

The `/execute` endpoint runs commands as the container's process user. The API key is the only access control — keep it private and avoid passing unsanitized user input into the `command` parameter.
