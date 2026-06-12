import os
import subprocess
from datetime import date
from pathlib import Path

import storage as minio_storage
from audio_manager import TextToVoice
from paths import (
    AUDIO_FILES_DIR,
)
from paths import SLIDE_IMG_FILES_DIR as IMG_FILES_DIR
from paths import (
    VIDEO_FILES_DIR,
)

from .image_extractor import ImageExtractor
from .ppt_generator import PPTGenerator


def _epoch_dir(epoch: int, video_type: str | None) -> str:
    return f"{video_type}-epoch_{epoch}" if video_type else f"epoch_{epoch}"


def _minio_video_path(video_type: str | None, filename: str) -> str:
    today = date.today()
    return f"{today.year}/{today.month:02d}/{today.day:02d}/{video_type or 'unknown'}/{filename}"


class VideoGenerator:
    """
    A singleton class for generating and processing video files using FFmpeg.
    It supports creating MP4 videos from images and audio, re-encoding videos,
    and combining multiple videos into one.
    """

    _instance = None
    job_store = {}

    def __new__(cls, *args, **kwargs):
        """
        Ensures only one instance of VideoGenerator exists.

        Returns:
            Singleton instance of the class.
        """
        if not cls._instance:
            cls._instance = super().__new__(cls, *args, **kwargs)
            cls._instance.connection = "Video Generator"
        return cls._instance

    def get_job(self, job_id: str):
        """
        Retrieves job metadata by job ID.

        Args:
            job_id (str): Unique identifier of the job.

        Returns:
            Job details if available, otherwise None.
        """
        return self.job_store.get(job_id)

    def set_job_status(self, job_id, status='pending'):
        """
        Sets or updates the status of a video processing job.

        Args:
            job_id (str): Unique identifier of the job.
            status (str, optional): Job status (default: "pending").

        Returns:
            Job ID and its updated metadata dictionary.
        """
        self.job_store[job_id] = {"status": status}
        return job_id, self.job_store.get(job_id)

    def convert_to_mp4(
        self,
        job_id: str,
        image_file: str,
        audio_file: str,
        epoch: int | None = None,
        video_type: str | None = None,
        upload_to_minio: bool = False,
    ):
        """
        Creates a MP4 video by combining a static image and an audio track.

        Args:
            job_id (str): Unique identifier of the job.
            image_file (str): The image file to use as the video background.
            audio_file (str): The audio file to include in the video.
            epoch (str | None): Optional epoch value; files are stored under
                video_files/epoch_<epoch>/ when provided.

        Side Effects:
            - Generates an MP4 file stored in VIDEO_FILES_DIR[/epoch_<epoch>].
            - Removes the original image file after processing.
            - Updates job_store with job status, errors, and output details.
        """
        try:
            video_file = f'{image_file.split(".")[0]}.mp4'

            img_path = (
                Path(IMG_FILES_DIR, _epoch_dir(epoch, video_type), image_file)
                if epoch
                else Path(IMG_FILES_DIR, image_file)
            )
            audio_path = Path(AUDIO_FILES_DIR, audio_file)
            out_dir = (
                Path(VIDEO_FILES_DIR, _epoch_dir(epoch, video_type))
                if epoch
                else VIDEO_FILES_DIR
            )
            out_path = Path(out_dir, video_file)
            out_dir.mkdir(parents=True, exist_ok=True)

            cmd = [
                "ffmpeg",
                "-loop",
                "1",
                "-i",
                str(img_path),
                "-i",
                str(audio_path),
                "-vf",
                "scale=trunc(iw/2)*2:trunc(ih/2)*2",
                "-c:v",
                "libx264",
                "-tune",
                "stillimage",
                "-c:a",
                "aac",
                "-b:a",
                "192k",
                "-ac",
                "2",
                "-ar",
                "44100",
                "-crf",
                "23",
                "-r",
                "30",
                "-pix_fmt",
                "yuv420p",
                "-movflags",
                "+faststart",
                "-shortest",
                str(out_path),
            ]

            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode != 0:
                self.job_store[job_id] = {
                    "status": "failed",
                    "error": "ffmpeg failed",
                    "stderr": result.stderr,
                }
                return

            # ensure file is fully flushed before marking completed
            with open(out_path, "rb") as f:
                os.fsync(f.fileno())

            if img_path.exists():
                img_path.unlink()

            result = {
                "status": "completed",
                "video_file": str(out_path),
                "filename": video_file,
            }
            if upload_to_minio:
                object_name = _minio_video_path(video_type, video_file)
                minio_storage.upload_file(
                    object_name, str(out_path), content_type="video/mp4"
                )
                result["minio_object"] = object_name
                result["minio_url"] = minio_storage.get_presigned_url(
                    object_name
                )
                out_path.unlink(missing_ok=True)
            self.job_store[job_id] = result
        except Exception as e:
            self.job_store[job_id] = {"status": "failed", "error": str(e)}

    @staticmethod
    def convert_mp4_to_mp4(
        video_file: str,
        upload_to_minio: bool = False,
        video_type: str | None = None,
    ):
        """
        Re-encodes an MP4 video with standardized settings.

        Args:
            video_file (str): Name of the MP4 file to re-encode.

        Returns:
            On success, includes video file path and filename.
            On failure, includes error details.
        """
        try:
            input_path = Path(VIDEO_FILES_DIR, video_file)
            output_path = Path(VIDEO_FILES_DIR, 'temp.mp4')

            cmd = [
                "ffmpeg",
                "-i",
                str(input_path),
                "-c:v",
                "libx264",
                "-crf",
                "23",
                "-preset",
                "fast",
                "-c:a",
                "aac",
                "-b:a",
                "192k",
                "-ac",
                "2",
                "-ar",
                "44100",
                "-r",
                "30",
                "-pix_fmt",
                "yuv420p",
                "-movflags",
                "+faststart",
                str(output_path),
            ]

            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode != 0:
                return {"error": "ffmpeg failed", "stderr": result.stderr}

            output_path.rename(input_path)
            result = {"video_file": str(input_path), "filename": video_file}
            if upload_to_minio:
                object_name = _minio_video_path(video_type, video_file)
                minio_storage.upload_file(
                    object_name, str(input_path), content_type="video/mp4"
                )
                result["minio_object"] = object_name
                result["minio_url"] = minio_storage.get_presigned_url(
                    object_name
                )
            return result
        except Exception as e:
            return {"error": str(e)}

    def combine_videos(
        self,
        video_file_name: str,
        video_files: list,
        epoch: int | None = None,
        video_type: str | None = None,
        upload_to_minio: bool = False,
    ):
        """
        Combines multiple MP4 videos into a single file.

        Args:
            video_file_name (str): The base name of the output video file.
            video_files (list): List of video file names to combine.
            epoch (str | None): Optional epoch value; files are read from
                video_files/epoch_<epoch>/ and the folder is removed on
                success.

        Returns:
            dict: On success, includes status, file path, and filename.
                  On failure, includes error details.

        Side Effects:
            - Creates a combined MP4 file stored in the epoch subfolder.
            - Deletes individual slide files after combining.
            - Updates job_store with job status and output details.
        """
        try:
            src_dir = (
                Path(VIDEO_FILES_DIR, _epoch_dir(epoch, video_type))
                if epoch
                else VIDEO_FILES_DIR
            )
            list_file = Path(src_dir, "videos.txt")
            video_path = Path(src_dir, f"{video_file_name}.mp4")
            src_dir.mkdir(parents=True, exist_ok=True)

            if not video_files:
                self.job_store[video_file_name] = {
                    "status": "failed",
                    "error": "No video files provided.",
                }
                return

            if len(video_files) == 1:
                src = Path(src_dir, video_files[0])
                src.rename(video_path)
                result = {
                    "status": "completed",
                    "file_path": str(video_path),
                    "filename": f"{video_file_name}.mp4",
                }
                if upload_to_minio:
                    object_name = _minio_video_path(
                        video_type, f"{video_file_name}.mp4"
                    )
                    minio_storage.upload_file(
                        object_name, str(video_path), content_type="video/mp4"
                    )
                    minio_url = minio_storage.get_presigned_url(object_name)
                    result["minio_object"] = object_name
                    result["minio_url"] = minio_url
                    result["file_path"] = minio_url
                    video_path.unlink(missing_ok=True)
                self.job_store[video_file_name] = result
                return

            with open(list_file, "w+") as f:
                for file_name in video_files:
                    file_path = Path(src_dir, file_name)
                    if file_path.exists():
                        f.write(f"file '{str(file_path)}'\n")
                    else:
                        self.job_store[video_file_name] = {
                            "status": "failed",
                            "error": "ffmpeg failed",
                            "stderr": f"Video file {file_name} not found at {src_dir}",
                        }
                        return

            cmd = [
                "ffmpeg",
                "-f",
                "concat",
                "-safe",
                "0",
                "-i",
                str(list_file),
                "-c",
                "copy",
                "-movflags",
                "+faststart",
                str(video_path),
            ]
            result = subprocess.run(cmd, capture_output=True, text=True)

            if result.returncode != 0:
                self.job_store[video_file_name] = {
                    "status": "failed",
                    "error": "ffmpeg failed",
                    "stderr": result.stderr,
                }
            else:
                for file_name in video_files:
                    file_path = Path(src_dir, file_name)
                    if file_path.exists():
                        file_path.unlink()

                result = {
                    "status": "completed",
                    "file_path": str(video_path),
                    "filename": f"{video_file_name}.mp4",
                }
                if upload_to_minio:
                    object_name = _minio_video_path(
                        video_type, f"{video_file_name}.mp4"
                    )
                    minio_storage.upload_file(
                        object_name, str(video_path), content_type="video/mp4"
                    )
                    minio_url = minio_storage.get_presigned_url(object_name)
                    result["minio_object"] = object_name
                    result["minio_url"] = minio_url
                    result["file_path"] = minio_url
                    video_path.unlink(missing_ok=True)
                self.job_store[video_file_name] = result
        except Exception as e:
            self.job_store[video_file_name] = {
                "status": "failed",
                "error": str(e),
            }


__all__ = [
    'VideoGenerator',
    'PPTGenerator',
    'ImageExtractor',
    'TextToVoice',
]
