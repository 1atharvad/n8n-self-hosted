from typing import Any

from pydantic import BaseModel, model_validator


class TTSRequest(BaseModel):
    text: str
    voice: str = "am_michael"


class PPTRequest(BaseModel):
    template_file: str
    template_slide: int
    old_text: dict[str, str]
    jobs: list[dict[str, Any]]


class ExtractSlidesRequest(BaseModel):
    file_name: str
    start_slide: int
    end_slide: int
    total_slides: int
    epoch: int | None = None
    video_type: str | None = None


class ConvertToMp4Request(BaseModel):
    image_file: str
    audio_file: str
    epoch: int | None = None
    video_type: str | None = None
    upload_to_minio: bool = False


class ConvertMp4Request(BaseModel):
    video_file: str
    upload_to_minio: bool = False
    video_type: str | None = None


class CombineVideosRequest(BaseModel):
    video_file_name: str
    video_files: list[str]
    epoch: int | None = None
    video_type: str | None = None
    upload_to_minio: bool = False


class LinkedInScrapeRequest(BaseModel):
    search_term: str
    location: str = ""
    batch_size: int = 10
    start_index: int = 0
    job_type: str | None = None
    is_remote: bool = False
    hours_old: int | None = None
    easy_apply: bool = False
    linkedin_fetch_description: bool = True
    linkedin_company_ids: list[int] | None = None
    proxies: list[str] | str | None = None

    @model_validator(mode="after")
    def resolve_exclusive_filters(self) -> "LinkedInScrapeRequest":
        # LinkedIn: only one of hours_old / easy_apply may be used.
        # hours_old takes priority; easy_apply is silently dropped.
        if self.hours_old is not None and self.easy_apply:
            self.easy_apply = False
        return self


class IndeedScrapeRequest(BaseModel):
    search_term: str
    location: str = ""
    batch_size: int = 10
    start_index: int = 0
    distance: int = 50
    job_type: str | None = None
    is_remote: bool = False
    hours_old: int | None = None
    easy_apply: bool = False
    country_indeed: str = "usa"
    proxies: list[str] | str | None = None

    @model_validator(mode="after")
    def resolve_exclusive_filters(self) -> "IndeedScrapeRequest":
        # Indeed: only one of hours_old / (job_type or is_remote) /
        # easy_apply may be used. Priority: hours_old > job_type/is_remote
        # > easy_apply — lower-priority filters are silently dropped.
        if self.hours_old is not None:
            self.job_type = None
            self.is_remote = False
            self.easy_apply = False
        elif self.job_type or self.is_remote:
            self.easy_apply = False
        return self


class ExecuteRequest(BaseModel):
    command: str | None = None
    script: str | None = None

    @model_validator(mode="after")
    def check_exactly_one(self) -> "ExecuteRequest":
        if not self.command and not self.script:
            raise ValueError("Either 'command' or 'script' must be provided")
        if self.command and self.script:
            raise ValueError(
                "Only one of 'command' or 'script' may be provided"
            )
        return self
