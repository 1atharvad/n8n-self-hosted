---
title: Credentials Overview
description: How n8n credentials work, naming conventions, encryption, and which workflows need which credentials.
sidebar:
  order: 1
---

Credentials in n8n store API keys, passwords, and connection strings securely. They are encrypted at rest using `N8N_ENCRYPTION_KEY` and referenced by name in workflow nodes.

## How to create a credential

1. In n8n, click **Settings** (gear icon) → **Credentials** → **Add credential**.
2. Search for the credential type by name.
3. Fill in the fields described in the relevant page below.
4. Click **Save** and optionally **Test** to verify the connection.

## Required credentials by workflow

| Credential | Used by |
|---|---|
| [Google OAuth2 & API Keys](/docs/credentials/google-oauth/) | YouTube Video Upload, Schedule Management, Telegram Voice to Text |
| [FastAPI Server](/docs/credentials/fastapi-server/) | RemoteExecute node (Video Creation, Cleanup, Backup), Job Scrapper |
| Header Auth (Media API key) | Text to Voice Converter, Video Creation, Combine Videos |
| OpenAI API | Job Scrapper, Script Generator, Job Video Error Handling, Schedule Management, Voice Chat Agent |
| PostgreSQL | Job Scrapper, Script Generator, Cleanup & Reset Database |
| YouTube OAuth2 | Youtube Video Upload |
| SMTP | Job Video Error Handling |
| Telegram API | Schedule Management System (if active) |
| Redis | Worker Monitor, any workflow using the Redis node |

See [Other Credentials](/docs/credentials/other-credentials/) for setup details on all of these.

## Naming convention

Use consistent names so workflows can reference them without confusion:

| Credential | Suggested name |
|---|---|
| FastAPI Server | `FastAPI Server (Internal)` |
| Header Auth (API key) | `Media API Key` |
| OpenAI API | `OpenAI` |
| PostgreSQL | `PostgreSQL (n8n)` |
| YouTube OAuth | `YouTube (JNN Channel)` |
| SMTP | `Gmail SMTP` |
| Telegram | `Telegram Bot` |
| Redis | `Redis` |

## Credential encryption

All credentials are encrypted using `N8N_ENCRYPTION_KEY`. **Keep a copy of this key in a password manager.** If you lose it after migrating to a new server, all credentials become unreadable and must be re-entered.

If you see `Error: Could not decrypt credentials` after moving the n8n data directory, the encryption key has changed. Set `N8N_ENCRYPTION_KEY` back to the original value and restart n8n.

## Verifying credentials after setup

1. Open each workflow listed above in n8n.
2. Click any node that uses a credential and confirm the correct credential is selected in the **Credential** dropdown.
3. For HTTP Request nodes: confirm the URL, method, and auth header match the [Media API docs](/docs/services/media-api/).
4. Run a test execution of a simple sub-workflow (e.g. **Text to Voice Converter** with a short string) to verify the end-to-end connection.
