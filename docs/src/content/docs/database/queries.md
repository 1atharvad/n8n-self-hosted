---
title: Useful Queries
description: SQL queries for monitoring pipeline progress, checking run status, and debugging failures.
sidebar:
  order: 6
---

Connect to the database:
```bash
docker exec -it postgres psql -U $POSTGRES_USER -d $POSTGRES_DB
```

---

## Pipeline progress for today's run

Check where each job is in the pipeline:

```sql
SELECT
    id,
    company_name,
    position,
    script_added,
    audio_added,
    video_created
FROM job_listing.job_links
WHERE date = CURRENT_DATE
ORDER BY id;
```

---

## Count jobs per stage

How many jobs have made it through each step:

```sql
SELECT
    COUNT(*)                              AS total,
    COUNT(*) FILTER (WHERE script_added)  AS with_script,
    COUNT(*) FILTER (WHERE audio_added)   AS with_audio,
    COUNT(*) FILTER (WHERE video_created) AS with_video
FROM job_listing.job_links
WHERE date = CURRENT_DATE;
```

---

## Latest pipeline runs

See the most recent run statuses:

```sql
SELECT
    epoch,
    date,
    status,
    num_of_jobs,
    start_time,
    end_time,
    mp4_name
FROM job_listing.mp4_list
ORDER BY id DESC
LIMIT 10;
```

---

## Today's failed runs

```sql
SELECT
    epoch,
    status,
    start_time,
    execution_id
FROM job_listing.mp4_list
WHERE date = CURRENT_DATE
  AND status = 'failed';
```

---

## Jobs without audio (stuck in Script Generator)

```sql
SELECT id, company_name, position, script_added, audio_added
FROM job_listing.job_links
WHERE date = CURRENT_DATE
  AND script_added = true
  AND audio_added = false;
```

---

## Jobs without video (stuck in Video Creation)

```sql
SELECT id, company_name, position, audio_added, video_created, audio_file_name
FROM job_listing.job_links
WHERE date = CURRENT_DATE
  AND audio_added = true
  AND video_created = false;
```

---

## n8n execution history (recent)

```sql
SELECT
    id,
    "workflowId",
    "finished",
    "startedAt",
    "stoppedAt",
    "status"
FROM execution_entity
ORDER BY "startedAt" DESC
LIMIT 20;
```

---

## Count n8n executions by workflow

```sql
SELECT
    w.name AS workflow_name,
    COUNT(e.id) AS execution_count,
    COUNT(*) FILTER (WHERE e.status = 'success') AS success_count,
    COUNT(*) FILTER (WHERE e.status = 'error') AS error_count
FROM execution_entity e
JOIN workflow_entity w ON w.id::text = e."workflowId"
WHERE e."startedAt" > NOW() - INTERVAL '7 days'
GROUP BY w.name
ORDER BY execution_count DESC;
```

---

## Reset today's pipeline (manual cleanup)

Use with care — this is what the Cleanup & Reset Database workflow does automatically at midnight:

```sql
-- Delete all job rows for today
DELETE FROM job_listing.job_links WHERE date = CURRENT_DATE;

-- Delete all run records for today
DELETE FROM job_listing.mp4_list WHERE date = CURRENT_DATE;
```
