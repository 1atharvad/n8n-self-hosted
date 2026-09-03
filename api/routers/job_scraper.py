from fastapi import APIRouter, BackgroundTasks
from fastapi.responses import JSONResponse

from job_scraper import JobScraper
from schemas import (
    IndeedScrapeRequest,
    LinkedInScrapeRequest,
)

from .utils import respond_job_status

router = APIRouter(tags=["Job Scraper"])
job_scraper = JobScraper()


@router.post('/job-scrape/linkedin')
async def start_linkedin_scrape(
    req: LinkedInScrapeRequest, background_tasks: BackgroundTasks
):
    """
    Creates a job to scrape LinkedIn job listings in the background.
    """
    job_id, job = job_scraper.set_job_status(status='pending')
    background_tasks.add_task(
        job_scraper.scrape_linkedin_job,
        job_id,
        req.search_term,
        req.location,
        req.batch_size,
        req.start_index,
        req.job_type,
        req.is_remote,
        req.hours_old,
        req.easy_apply,
        req.linkedin_fetch_description,
        req.linkedin_company_ids,
        req.proxies,
    )
    return JSONResponse(respond_job_status(job_id, job))


@router.post('/job-scrape/indeed')
async def start_indeed_scrape(
    req: IndeedScrapeRequest, background_tasks: BackgroundTasks
):
    """
    Creates a job to scrape Indeed job listings in the background.
    """
    job_id, job = job_scraper.set_job_status(status='pending')
    background_tasks.add_task(
        job_scraper.scrape_indeed_job,
        job_id,
        req.search_term,
        req.location,
        req.batch_size,
        req.start_index,
        req.distance,
        req.job_type,
        req.is_remote,
        req.hours_old,
        req.easy_apply,
        req.country_indeed,
        req.proxies,
    )
    return JSONResponse(respond_job_status(job_id, job))


@router.get('/job-scrape-status/{job_id}')
async def check_job_scrape_status(job_id: str):
    """
    Checks the current status of a job scrape job.

    Args:
        job_id (str): Unique ID of the scrape job.

    Returns:
        Current job status including 'pending', 'completed', or 'failed'.
    """
    job = job_scraper.get_job(job_id)
    return JSONResponse(respond_job_status(job_id, job))


@router.get('/job-scrape-result/{job_id}')
async def get_job_scrape_result(job_id: str):
    """
    Retrieve the resulting job listings if the scrape job is completed.

    Args:
        job_id (str): Unique ID of the scrape job.

    Returns:
        List of scraped job listings or error/status info.
    """
    job = job_scraper.get_job(job_id)
    job_response = respond_job_status(job_id, job)
    if job_response.get('status') == 'completed':
        job_response['jobs'] = job.get('jobs', [])
    return JSONResponse(job_response)
