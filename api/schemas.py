from typing import Any
from pydantic import BaseModel


class TTSRequest(BaseModel):
    text: str


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


class CleanupRequest(BaseModel):
    folders: list[str] | None = None  # None = clean all folders


class VideoFileRequest(BaseModel):
    filename: str


class ExecuteRequest(BaseModel):
    command: str
