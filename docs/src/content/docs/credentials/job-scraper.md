---
title: Job Scraper (JobSpy)
description: The Job Scrapper workflow now scrapes LinkedIn and Indeed directly via the Media API's JobSpy-based job scraper — no Google Custom Search credential required.
sidebar:
  order: 3
---

**Used by:** Job Scrapper workflow
**Type:** No credential needed — the Media API's `/job-scrape/*` endpoints scrape LinkedIn and Indeed directly using [JobSpy](https://github.com/speedyapply/JobSpy).

The Job Scrapper previously used the Google Custom Search JSON API to find job listings via site-specific queries. That approach was unreliable — the free tier's 100 queries/day quota was easy to exhaust, and results depended on Google's indexing rather than the job boards themselves.

It has been replaced with the Media API's built-in job scraper, which calls LinkedIn and Indeed directly and needs no API key, CX ID, or Google Cloud project.

See [Media API → Job Scraper](/docs/services/media-api/#job-scraper) for the endpoint reference.

---

## Updating the workflow

Open the **Job Scrapper** workflow in n8n and replace the `Google Search` HTTP Request node(s) with calls to the Media API:

1. `POST /api/core/job-scrape/linkedin` or `POST /api/core/job-scrape/indeed` with the search parameters — returns `{ job_id }`.
2. Poll `GET /api/core/job-scrape-status/{job_id}` until `status: completed`.
3. Fetch results from `GET /api/core/job-scrape-result/{job_id}`.

Use the **FastAPI Server** credential (same `X-API-Key` header auth as the rest of the Media API) rather than a Google API key.

Save the workflow, then run `npm run pull-workflows` to commit the change to git.
