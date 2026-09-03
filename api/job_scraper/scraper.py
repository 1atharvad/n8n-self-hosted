import json
import uuid

from jobspy import scrape_jobs


class JobScraper:
    """
    A singleton class for scraping job listings using JobSpy and tracking
    scrape jobs with status metadata, following the same job_store pattern
    as the other background workers in this API.
    """

    _instance = None
    job_store = {}

    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            cls._instance = super().__new__(cls, *args, **kwargs)
        return cls._instance

    def get_job(self, job_id: str):
        return self.job_store.get(job_id)

    def set_job_status(self, job_id='', status='pending'):
        if job_id == '':
            job_id = str(uuid.uuid4())
        if job_id not in self.job_store:
            self.job_store[job_id] = {}
        self.job_store[job_id]["status"] = status
        return job_id, self.job_store.get(job_id)

    def _run_scrape(self, job_id: str, **jobspy_kwargs):
        """
        Runs a JobSpy scrape and stores the resulting listings on the job.

        Job Store Structure:
            {
                "status": "completed" | "failed",
                "jobs": [<job dict>, ...] | None,
                "error": "<error message>" (if failed)
            }
        """
        try:
            jobs_df = scrape_jobs(verbose=2, **jobspy_kwargs)
            self.job_store[job_id] = {
                "status": "completed",
                "jobs": json.loads(
                    jobs_df.to_json(orient="records", date_format="iso")
                ),
            }
        except Exception as e:
            self.job_store[job_id] = {"status": "failed", "error": str(e)}

    def scrape_linkedin_job(
        self,
        job_id: str,
        search_term: str,
        location: str = "",
        batch_size: int = 10,
        start_index: int = 0,
        job_type: str | None = None,
        is_remote: bool = False,
        hours_old: int | None = None,
        easy_apply: bool = False,
        linkedin_fetch_description: bool = False,
        linkedin_company_ids: list[int] | None = None,
        proxies: list[str] | str | None = None,
    ):
        self._run_scrape(
            job_id,
            site_name="linkedin",
            search_term=search_term,
            location=location,
            results_wanted=batch_size,
            offset=start_index,
            job_type=job_type,
            is_remote=is_remote,
            hours_old=hours_old,
            easy_apply=easy_apply,
            linkedin_fetch_description=linkedin_fetch_description,
            linkedin_company_ids=linkedin_company_ids,
            proxies=proxies,
        )

    def scrape_indeed_job(
        self,
        job_id: str,
        search_term: str,
        location: str = "",
        batch_size: int = 10,
        start_index: int = 0,
        distance: int = 50,
        job_type: str | None = None,
        is_remote: bool = False,
        hours_old: int | None = None,
        easy_apply: bool = False,
        country_indeed: str = "usa",
        proxies: list[str] | str | None = None,
    ):
        self._run_scrape(
            job_id,
            site_name="indeed",
            search_term=search_term,
            location=location,
            results_wanted=batch_size,
            offset=start_index,
            distance=distance,
            job_type=job_type,
            is_remote=is_remote,
            hours_old=hours_old,
            easy_apply=easy_apply,
            country_indeed=country_indeed,
            proxies=proxies,
        )
