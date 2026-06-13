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
