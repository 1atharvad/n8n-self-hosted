---
title: Other Credentials
description: Setup guide for OpenAI, PostgreSQL, Redis, SMTP, Telegram, and MinIO/S3 credentials.
sidebar:
  order: 4
---

## Header Auth (Media API key)

**Used by:** Text to Voice Converter, Video Creation, Combine Videos, and other workflows that call the Media API directly.

Most HTTP Request nodes send the API key inline. To standardize, create a **Header Auth** credential:

**Credential type:** `Header Auth`

| Field | Value |
|---|---|
| Name | `X-API-Key` |
| Value | Value of the `API_KEY` environment variable |

Then in each HTTP Request node → **Authentication** → **Predefined Credential Type** → `Header Auth` → select this credential.

---

## OpenAI (ChatGPT)

**Used by:** Script Generator, Job Scrapper, Job Video Error Handling, Schedule Management (AI agent), Voice Chat Agent  
**Credential type:** `OpenAI API`

1. Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys).
2. Click **Create new secret key**, give it a name (e.g. `n8n`), and copy the key.
3. In n8n → **Settings** → **Credentials** → **Add credential** → search **OpenAI API**.
4. Paste the key into the **API Key** field and click **Save**.

After creating, reference it in LangChain nodes by selecting **OpenAI Chat Model**.

---

## PostgreSQL

**Used by:** Job Scrapper, Script Generator, Cleanup & Reset Database  
**Credential type:** `Postgres`

| Field | Value |
|---|---|
| Host | `postgres` (Docker container name — internal network) |
| Port | `5432` (or value of `POSTGRES_PORT`) |
| Database | Value of `POSTGRES_DB` |
| User | Value of `POSTGRES_USER` |
| Password | Value of `POSTGRES_PASSWORD` |
| SSL | Off (internal network, not needed) |

---

## YouTube & Google Sheets

See [Google OAuth2 & API Keys](/docs/credentials/google-oauth/) for full setup — Client ID, Client Secret, consent screen, and connecting accounts for YouTube and Sheets.

---

## SMTP (Email)

**Used by:** Job Video Error Handling  
**Credential type:** `SMTP`

| Field | Value |
|---|---|
| Host | `smtp.gmail.com` (or your SMTP server) |
| Port | `587` (TLS) or `465` (SSL) |
| User | Your email address |
| Password | **App password**, not your account password. Generate one in Google Account → Security → App passwords. |
| SSL/TLS | `STARTTLS` for port 587 |

---

## Telegram {#telegram}

**Used by:** Telegram (Voice to Text) in the Schedule Management System  
**Credential type:** `Telegram API`

| Field | Value |
|---|---|
| Access Token | Token from [@BotFather](https://t.me/BotFather). Send `/newbot` to BotFather and follow the prompts. |

---

## Redis

**Used by:** Worker Monitor, n8n queue (Bull) — also available for direct use in workflows via the Redis node.  
**Credential type:** `Redis`

| Field | Value |
|---|---|
| Host | `redis` (Docker container name — internal network) |
| Port | `6379` |
| Password | Leave empty (no auth configured by default) |
| Database | `1` |

> **Database 1** is the application database used by this stack. Database 0 is used by n8n's Bull queue (job scheduling). Keep them separate to avoid key collisions.

---

## MinIO / S3

MinIO is accessed by the Media API directly via environment variables — no n8n credential is needed for the current workflows.

If you add a workflow node that reads from MinIO directly, use the **AWS S3** credential type:

| Field | Value |
|---|---|
| Access Key ID | Value of `MINIO_ROOT_USER` |
| Secret Access Key | Value of `MINIO_ROOT_PASSWORD` |
| Region | `us-east-1` (any value works for MinIO) |
| Endpoint | `http://minio:9000` (internal Docker network) |
