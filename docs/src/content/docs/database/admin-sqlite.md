---
title: Admin SQLite Database
description: SQLite tables used by the Admin API — users, env_vars, app_config, and audit_log.
sidebar:
  order: 3
---

**Location:** `admin-api/data/` (mounted as a Docker volume at `/app/data/` inside the container)  
**ORM:** SQLAlchemy async  
**Migrations:** None — tables are auto-created on first startup by the ORM

The admin-api uses SQLite instead of PostgreSQL to keep auth and config separate from the automation data. This makes the admin panel portable and independent — it can run on a server without any PostgreSQL configuration.

---

## `users`

Admin panel login accounts.

| Column | Type | Description |
|---|---|---|
| `id` | `VARCHAR(36)` PK | UUID |
| `username` | `VARCHAR(64)` UNIQUE | Login username |
| `hashed_password` | `VARCHAR(255)` | bcrypt hash |
| `role` | `VARCHAR(16)` | `admin` or `viewer` |
| `allowed_containers` | `JSON` | Nullable. Container names this user can view logs for. `null` = unrestricted (admin). |
| `is_active` | `BOOLEAN` | Whether the user can log in |
| `created_at` | `DATETIME` | Creation timestamp (UTC) |
| `updated_at` | `DATETIME` | Last update timestamp (UTC) |

A default admin row is inserted by `seed_admin_if_empty()` on first startup using `ADMIN_USERNAME` / `ADMIN_PASSWORD`. Subsequent starts do not overwrite if an admin user already exists.

---

## `env_vars`

Environment variables managed through the Settings page.

| Column | Type | Description |
|---|---|---|
| `key` | `VARCHAR(256)` PK | Variable name (e.g. `POSTGRES_PASSWORD`) |
| `value` | `VARCHAR(4096)` | AES-Fernet encrypted value |
| `updated_at` | `DATETIME` | Last update timestamp |

### Encryption

Values are encrypted using **Fernet** (AES-128-CBC + HMAC-SHA256), keyed from the SHA-256 hash of `JWT_SECRET`. They are decrypted in memory when the API responds — never stored or logged in plaintext.

If you rotate `JWT_SECRET`, all encrypted values become unreadable and must be re-entered through the Settings page.

---

## `app_config`

Internal admin panel configuration (distinct from env vars that go to `.env`).

| Column | Type | Description |
|---|---|---|
| `key` | `VARCHAR(128)` PK | Config key |
| `value` | `VARCHAR(4096)` | Value (AES-encrypted for secrets) |
| `updated_at` | `DATETIME` | Last update timestamp |

### Current keys

| Key | Description |
|---|---|
| `github_token` | AES-encrypted GitHub personal access token for Secrets sync |
| `github_repo` | GitHub repository in `owner/repo` format |

---

## `audit_log`

Immutable record of all admin actions. Entries cannot be deleted through the UI.

| Column | Type | Description |
|---|---|---|
| `id` | `VARCHAR(36)` PK | UUID |
| `actor_id` | `VARCHAR(36)` | UUID of the user who performed the action |
| `actor_name` | `VARCHAR(64)` | Username at the time of the action |
| `action` | `VARCHAR(64)` | Action type |
| `target_name` | `VARCHAR(64)` | What was acted on |
| `detail` | `VARCHAR(255)` | Optional extra context |
| `ip_address` | `VARCHAR(45)` | Client IP (IPv4 or IPv6) |
| `created_at` | `DATETIME` | Timestamp (UTC), indexed |

### Action types

| Action | When |
|---|---|
| `auth.login` | Successful login |
| `auth.login_failed` | Failed login attempt |
| `user.create` | New user created |
| `user.update` | User updated |
| `user.delete` | User deleted |
| `env_var.set` | Variable created or updated |
| `env_var.delete` | Variable deleted |
| `container.restart` | Container restart triggered |
| `backup.trigger` | Manual backup triggered |
| `github.config_set` | GitHub token/repo configured |

---

## Accessing the SQLite database directly

```bash
# Open the database inside the running container
docker exec -it admin-api sqlite3 /app/data/admin.db

# List tables
.tables

# Query audit log
SELECT actor_name, action, target_name, ip_address, created_at
FROM audit_log
ORDER BY created_at DESC
LIMIT 20;
```
