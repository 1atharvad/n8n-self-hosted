---
title: Settings Page
description: Managing environment variables, GitHub Secrets sync, and admin users.
sidebar:
  order: 4
---

**Route:** `/admin/settings`

Three tabs: **Environment**, **GitHub Config**, **Users**.

---

## Environment tab

Manages the `.env` file on the server.

### Viewing variables

All current variables are shown with their decrypted values. Variables are stored AES-encrypted in SQLite and decrypted on the fly when the page loads.

### Adding or editing a variable

1. Enter the key name and value.
2. Click **Save**.

When you save, the admin-api:
1. Encrypts the value with Fernet (AES-128-CBC + HMAC-SHA256, keyed from SHA-256 of `JWT_SECRET`).
2. Writes the encrypted value to the `env_vars` SQLite table.
3. Writes the plaintext value to the `.env` file on disk.
4. If GitHub is configured: encrypts the value with the repo's NaCl public key and pushes it as a `production` environment secret via the GitHub API.

### Deleting a variable

Removes the variable from SQLite, the `.env` file, and GitHub Secrets (if configured).

> **Important:** Changes to `.env` take effect on the **next container restart**. The admin panel writes the file but does not automatically restart services. Use the [Infrastructure page](/docs/admin-panel/infrastructure/) to restart containers, or trigger a deploy from the Deployments page.

---

## GitHub Config tab

Connects the env var store to GitHub Actions secrets. Once configured, every save/delete in the Environment tab syncs automatically to GitHub — so the GitHub Actions pipeline always has the latest secrets without manual management.

### Setup

1. Go to [github.com → Settings → Developer settings → Personal access tokens](https://github.com/settings/tokens).
2. Create a **Fine-grained token** with **`secrets: write`** permission on the target repository (under "Repository permissions").
3. In the admin panel → **Settings → GitHub Config**, enter:
   - **Token:** the personal access token
   - **Repository:** `owner/repo-name` format (e.g. `atharva/n8n-automation`)
4. Click **Save**. The token and repo are stored AES-encrypted in the SQLite `app_config` table.

### How the sync works

When a variable is saved, the admin-api:
1. Fetches the repository's public key from `GET https://api.github.com/repos/{owner}/{repo}/environments/production/secrets/public-key`.
2. Encrypts the variable value using the repo's **NaCl public key** (libsodium sealed box).
3. Calls `PUT https://api.github.com/repos/{owner}/{repo}/environments/production/secrets/{key}` with the encrypted value.

GitHub never receives the plaintext — it can only decrypt with its own private key. This matches the format GitHub Actions expects for secrets.

---

## Users tab

Manage who can access the admin panel.

### Fields

| Field              | Description                                                                              |
| ------------------ | ---------------------------------------------------------------------------------------- |
| Username           | Login username                                                                           |
| Password           | Hashed with bcrypt on save — not stored in plaintext                                     |
| Role               | `admin` (full access) or `viewer` (read-only, restricted containers)                     |
| Allowed containers | JSON array of container names for log access. Leave blank for unrestricted (admin only). |

### Default admin

A default admin is seeded from `ADMIN_USERNAME` / `ADMIN_PASSWORD` on first startup. Change the password here after initial setup.

### Role differences

| Feature            | Admin          | Viewer                    |
| ------------------ | -------------- | ------------------------- |
| View logs          | All containers | Only `allowed_containers` |
| View metrics       | Yes            | Yes                       |
| Restart containers | Yes            | No                        |
| Manage env vars    | Yes            | No                        |
| Manage users       | Yes            | No                        |
| View audit log     | Yes            | No                        |
| Trigger backups    | Yes            | No                        |
