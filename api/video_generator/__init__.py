from pathlib import Path
import subprocess
from .ppt_generator import PPTGenerator
from .image_extractor import ImageExtractor
from .text_to_voice import TextToVoice
import os

BASE_DIR = Path(__file__).resolve().parent.parent.parent
AUDIO_FILES_DIR = Path(BASE_DIR, 'n8n_files', 'audio_files')
IMG_FILES_DIR = Path(BASE_DIR, 'n8n_files', 'ppt_images')
IMG_VIDEO_FILES_DIR = Path(BASE_DIR, 'n8n_files', 'img_video_files')
VIDEO_FILES_DIR = Path(BASE_DIR, 'n8n_files', 'video_files')

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
            cls._instance = super(VideoGenerator, cls).__new__(cls, *args, **kwargs)
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
        if job_id not in self.job_store:
            self.job_store[job_id] = {}
        self.job_store[job_id]["status"] = status
        return job_id, self.job_store.get(job_id)

    def convert_to_mp4(self, job_id: str, image_file: str, audio_file: str):
        """
        Creates a MP4 video by combining a static image and an audio track.

        Args:
            job_id (str): Unique identifier of the job.
            image_file (str): The image file to use as the video background.
            audio_file (str): The audio file to include in the video.

        Side Effects:
            - Generates an MP4 file stored in IMG_VIDEO_FILES_DIR.
            - Removes the original image file after processing.
            - Updates job_store with job status, errors, and output details.
        """
        try:
            video_file = f'{image_file.split(".")[0]}.mp4'

            img_path = Path(IMG_FILES_DIR, image_file)
            audio_path = Path(AUDIO_FILES_DIR, audio_file)
            out_path = Path(IMG_VIDEO_FILES_DIR, video_file)
            IMG_VIDEO_FILES_DIR.mkdir(parents=True, exist_ok=True)

            cmd = [
                "ffmpeg", "-loop", "1",
                "-i", str(img_path),
                "-i", str(audio_path),
                "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
                "-c:v", "libx264", "-tune", "stillimage",
                "-c:a", "aac", "-b:a", "192k",
                "-ac", "2", "-ar", "44100",
                "-crf", "23", "-r", "30",
                "-pix_fmt", "yuv420p",
                "-movflags", "+faststart",
                "-shortest", str(out_path)
            ]

            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode != 0:
                os.chown(str(out_path), 1000, 1000)
                self.job_store[job_id] = {
                    "status": "failed",
                    "error": "ffmpeg failed",
                    "stderr": result.stderr
                }

            if img_path.exists():
                img_path.unlink()

            self.job_store[job_id] = {
                "status": "completed",
                "video_file": str(out_path),
                "filename": video_file
            }
        except Exception as e:
            self.job_store[job_id] = {
                "status": "failed",
                "error": str(e)
            }

    @staticmethod
    def convert_mp4_to_mp4(video_file: str):
        """
        Re-encodes an MP4 video with standardized settings.

        Args:
            video_file (str): Name of the MP4 file to re-encode.

        Returns:
            On success, includes video file path and filename.
            On failure, includes error details.
        """
        try:
            input_path = Path(IMG_VIDEO_FILES_DIR, video_file)
            output_path = Path(IMG_VIDEO_FILES_DIR, 'temp.mp4')

            cmd = [
                "ffmpeg",
                "-i", str(input_path),
                "-c:v", "libx264",
                "-crf", "23",
                "-preset", "fast",
                "-c:a", "aac",
                "-b:a", "192k",
                "-ac", "2", "-ar", "44100",
                "-r", "30",
                "-pix_fmt", "yuv420p",
                "-movflags", "+faststart",
                str(output_path)
            ]

            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode != 0:
                return {"error": "ffmpeg failed", "stderr": result.stderr}

            output_path.rename(input_path)
            return {
                "video_file": str(input_path),
                "filename": video_file
            }
        except Exception as e:
            return {"error": str(e)}

    def combine_videos(self, video_file_name: str, video_files: list):
        """
        Combines multiple MP4 videos into a single file.

        Args:
            video_file_name (str): The base name of the output video file.
            video_files (list): List of video file names to combine.

        Returns:
            dict: On success, includes status, file path, and filename.
                  On failure, includes error details.

        Side Effects:
            - Creates a combined MP4 file stored in VIDEO_FILES_DIR.
            - Deletes individual video segments after combining.
            - Updates job_store with job status and output details.
        """
        try:
            list_file = Path(BASE_DIR, "n8n_files", "videos.txt")
            video_path = Path(VIDEO_FILES_DIR, f"{video_file_name}.mp4")

            if not video_files or len(video_files) < 2:
                return {"error": "Please provide at least 2 video files."}

            with open(list_file, "w+") as f:
                for file_name in video_files:
                    file_path = Path(IMG_VIDEO_FILES_DIR, file_name)
                    if file_path.exists():
                        f.write(f"file '{str(file_path)}'\n")
                    else:
                        relative_path = file_path.relative_to(BASE_DIR)

                        if relative_path.exists():
                            f.write(f"file '{str(relative_path)}'\n")
                        else:
                            print('error')
                            self.job_store[video_file_name] = {
                                "status": "failed",
                                "error": "ffmpeg failed",
                                "stderr": f"Video file {file_name} not found at {video_path}"
                            }

            cmd = [
                "ffmpeg", "-f", "concat", "-safe", "0", "-i", str(list_file),
                "-c:v", "libx264", "-crf", "23", "-preset", "fast",
                "-c:a", "aac", "-b:a", "192k",
                "-ac", "2", "-ar", "44100",
                "-r", "30",
                "-pix_fmt", "yuv420p",
                "-movflags", "+faststart",
                str(video_path)
            ]
            result = subprocess.run(cmd, capture_output=True, text=True)

            if result.returncode != 0:
                self.job_store[video_file_name] = {
                    "status": "failed",
                    "error": "ffmpeg failed",
                    "stderr": result.stderr
                }
            else:
                for file_name in video_files:
                    file_path = Path(IMG_VIDEO_FILES_DIR, file_name)
                    if file_path.exists():
                        file_path.unlink()

                self.job_store[video_file_name] = {
                    "status": "completed",
                    "file_path": str(video_path),
                    "filename": f"{video_file_name}.mp4"
                }
        except Exception as e:
            self.job_store[video_file_name] = {
                "status": "failed",
                "error": str(e)
            }

__all__ = ['VideoGenerator', 'PPTGenerator', 'ImageExtractor', 'TextToVoice']