---
title: FastAPI Server Credential
description: Setting up the FastAPI Server custom credential used by the RemoteExecute node.
sidebar:
  order: 3
---

**Used by:** RemoteExecute custom node (Video Creation, Cleanup & Reset Database, Commit all workflows at 12 AM)  
**Credential type:** `FastAPI Server` (custom type defined in `custom-n8n-nodes/credentials/FastApiServerApi.credentials.ts`)

---

## Setup

1. In n8n → **Settings** → **Credentials** → **Add credential**.
2. Search for **FastAPI Server API**.
3. Fill in the fields:

| Field | Value |
|---|---|
| Base URL | `http://media-api:9374` for production (internal Docker network) |
| Base URL | `http://localhost:6060/api/core` for local dev (via Nginx) |
| API Key | Value of the `API_KEY` environment variable |

4. Click **Save**. n8n will test the connection against the `/health` endpoint.

If the test fails:
- Check that `API_KEY` in `.env` matches exactly what you entered.
- Check that the `media-api` container is running: `docker ps | grep media-api`.
- For local dev, ensure you're using `http://localhost:6060/api/core` (not `http://localhost:9374`) since Nginx is the entry point.

---

## Why two different base URLs

The `media-api` container is not directly exposed to the host — it's internal to the Docker network. All external access goes through Nginx on port 6060.

| Context | Base URL | Why |
|---|---|---|
| n8n inside Docker (production or dev) | `http://media-api:9374` | Direct container-to-container communication on the Docker network |
| Browser or local tools outside Docker | `http://localhost:6060/api/core` | Must go through Nginx |

The RemoteExecute node runs **inside** the n8n container, so it uses the direct `http://media-api:9374` URL in production. For local development where you might test the credential from a browser or Postman, use the Nginx URL.

---

## What the credential is used for

The `FastAPI Server` credential is read by the `RemoteExecute` custom node, which POSTs shell commands to `/execute` on the Media API. The API key is sent as the `X-API-Key` header.

See [RemoteExecute](/docs/custom-nodes/remote-execute/) for full details on the node.
