---
title: All Workflows
description: Complete list of all 34 n8n workflows organized by group, with IDs and active status.
sidebar:
  order: 1
---

All workflows are version-controlled as JSON in `n8n-workflows/workflows/`. Use `npm run pull-workflows` to sync from the live instance and `npm run push-workflows` to deploy local changes back.

## Workflow groups

| Group | Folder in n8n | Description |
|---|---|---|
| [JNN Pipeline](/docs/n8n-workflows/jnn-pipeline/) | `Youtube Stream (JNN)` | End-to-end job news video pipeline — scrape → script → TTS → video → YouTube |
| [YouTube Live Streaming](/docs/n8n-workflows/live-streaming/) | `Youtube Stream (JNN)` | Daily live stream automation via OBS + YouTube API + cjnnow |
| [Schedule Management](/docs/n8n-workflows/schedule-management/) | `Schedule Management System` | AI-powered shift scheduling and timesheet system via Telegram |
| [Medicine Reminder](/docs/n8n-workflows/medicine-reminder/) | root level | PanMom healthcare reminder — SOAP API + TTS + AI voice chat agent |
| [Utilities](/docs/n8n-workflows/utilities/) | root level | Nightly backup, global config sub-workflow, job ingestion webhook |

---

## Complete workflow list

### Youtube Stream (JNN)

| Workflow | ID | Active |
|---|---|---|
| Youtube Video Upload | `qdTPjAJEFePSZNC5` | yes |
| Job Scrapper | `2Kbv7D61qx6QiovN` | yes |
| Script Generator | `3CV8vOr3daIHXK6X` | yes |
| Text to Voice Converter | `7Nx6lwYZ4Vb8vD8v` | yes |
| Video Creation | `HmMxxv4eZOZGzrOl` | yes |
| Combine Videos | `66MHT0z3zhiYgblm` | yes |
| Job Video Error Handling | `3LEV6jB7r0TQcMN6` | yes |
| Cleanup & Reset Database | `cls465MeDCQ5kLdb` | yes |
| Scheduler for Youtube Video | `kWYlADplv47HnBgb` | yes |
| Video Report Creator | `13nsrEpCAcELKNMA` | yes |
| Instagram Video Upload | `h1kQfLNxCB994HE2` | no |

### YouTube Live Streaming

| Workflow | ID | Active |
|---|---|---|
| Start Stream | `5b7h0jDyoclJWReh` | yes |
| End Stream | `At21dbX6Z2zNsJbp` | yes |
| Add New Video to Stream | `ZyRPbgnaKH8JFLLP` | yes |
| Delete file from OBS Server | `iQh3Pg7VqAQ6YKGi` | yes |
| Create Stream Show | `cn9gyNxryLOBBhps` | yes |
| Text to Voice Converter (Streaming) | `haVleCvRojSl2XJ3` | yes |

### Schedule Management System

| Workflow | ID | Active |
|---|---|---|
| Shift Scheduler System | `0Btpj3XL2SbiOFK7` | no |
| Shift Notification System | `6ZFmKRv0H95RWU48` | no |
| Add / Update Timesheet Entry | `Cl83jXD14v6alJjm` | no |
| Telegram (Voice to Text) | `GJbzVQ49qGz8vZv4` | no |
| Add / Update Daily Report | `IMnHHCu7gxSxfeAi` | no |
| Add New Shift | `TrlEwaUo64KDpyvU` | no |
| Add New User | `oEPj7KrkxSck6RDI` | no |
| View Schedule | `pzoZqfcxHfTEw2f9` | no |

### Medicine Reminder (PanMom)

| Workflow | ID | Active |
|---|---|---|
| Medicine Reminder Bot | `l4PlSiGrMmW6cYY7` | yes |
| Get Medicine Schedule | `Pj9nwwSVoIoxPElb` | yes |
| Play Medicine Reminder | `FxdGFW3IBnSRPC1q` | yes |
| Mark Medicine Taken | `BhvmrZvggoiHWG0p` | yes |
| Voice Chat Agent | `UvhkwIqCXgv6abtN` | yes |
| panmom (webhook orchestrator) | `98rN1IU4YbNVeUGX` | yes |

### Utility (root level)

| Workflow | ID | Active |
|---|---|---|
| Commit all workflows at 12 AM | `GA1jepVVDQcboMKO` | yes |
| Get Global Data in JSON Format From Data Tables | `7x2kP8hsfNCvf5dY` | yes |
| Job Link Ingestion Webhook | `vnfqKuTvB4RU2fCE` | yes |

---

## Managing workflows

### Sync from n8n to git

```bash
npm run pull-workflows              # pull changed workflows
npm run pull-workflows:force        # overwrite even if unchanged
npm run pull-workflows:commit       # pull + auto git commit
npm run pull-workflows:force-commit # force pull + auto git commit
```

Also exports every credential (**encrypted** — see [Credentials](#credentials-backup) below) into `n8n-workflows/credentials/`, and n8n Data Tables into `n8n-workflows/data/`.

### Push from git to n8n

```bash
npm run push-workflows
```

**This is not an upsert.** It wipes every existing workflow and folder in n8n, then re-imports everything from the local JSON files (plus credentials and Data Tables), reassigns folders, and remaps every stale `Execute Workflow` sub-workflow reference and credential reference by name — since Postgres assigns new ids on import instead of keeping the ones from the export. Use this when deploying to a fresh n8n instance or restoring from a backup.

### Credentials backup

Credentials export/import alongside workflows automatically via `pull-workflows`/`push-workflows` — **encrypted**, never plaintext, so the files are safe to commit but only importable on an instance with the same `N8N_ENCRYPTION_KEY`.

:::caution
Every credential needs a **unique name**. Restoring matches credentials to their new ids by name, so duplicate names will cause the remap to pick one arbitrarily.
:::

### Adding a new workflow

1. Build and test the workflow in the n8n UI.
2. Run `npm run pull-workflows` to capture the JSON.
3. Commit the new file in `n8n-workflows/workflows/`.
4. Update this page with the workflow's purpose, trigger, and key integrations.
