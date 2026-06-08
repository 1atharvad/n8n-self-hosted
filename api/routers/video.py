from fastapi import APIRouter, BackgroundTasks
from fastapi.responses import JSONResponse

from schemas import (
    CombineVideosRequest,
    ConvertMp4Request,
    ConvertToMp4Request,
)
from video_generator import VideoGenerator

from .utils import respond_job_status

router = APIRouter(tags=["Video Generator"])
video = VideoGenerator()


@router.post('/convert-to-mp4')
async def convert_to_mp4(
    req: ConvertToMp4Request, background_tasks: BackgroundTasks
):
    """
    Convert an image and audio file into an MP4 video in the background.

    Args:
        req (ConvertToMp4Request): Contains 'image_file' and 'audio_file'.
        background_tasks (BackgroundTasks): FastAPI background task manager.

    Returns:
        Job status including job_id and status.
    """
    job_id, job = video.set_job_status(
        f'{req.image_file.split(".")[0]}-img', status='pending'
    )
    background_tasks.add_task(
        video.convert_to_mp4,
        job_id,
        req.image_file,
        req.audio_file,
        req.epoch,
        req.video_type,
        req.upload_to_minio,
    )
    return JSONResponse(respond_job_status(job_id, job))


@router.get('/convert-to-mp4-status/{job_id}')
async def check_mp4_status(job_id: str):
    """
    Check the current status of an image-to-MP4 video conversion job.

    Args:
        job_id (str): Unique identifier of the convert-to-MP4 job.

    Returns:
        A JSON object containing:
            - job_id (str): The ID of the job
            - status (str): Current job status ('pending', 'completed', 'failed')
            - file_path (str, optional): Path to the completed MP4 video if job
                succeeded
            - filename (str, optional): Name of the resulting MP4 file
            - error (str, optional): Error message if the job failed
            - stderr (str, optional): ffmpeg stderr output if the job failed
    """
    job = video.get_job(job_id)
    job_response = respond_job_status(job_id, job)
    if job_response.get('status') == 'completed':
        return JSONResponse(
            {
                'status': 'completed',
                'file_path': str(job['video_file']),
                'filename': job['filename'],
            }
        )
    return JSONResponse(job_response)


@router.post('/convert-mp4-to-mp4')
async def convert_mp4_to_mp4(req: ConvertMp4Request):
    """
    Convert an existing MP4 video to a standardized MP4 format using ffmpeg.

    Args:
        req (ConvertMp4Request): Request payload containing 'video_file'.

    Returns:
        JSONResponse:
            - If successful: JSON object with 'video_file' path and 'filename'.
            - If failed: JSON object containing 'error' and optional 'stderr'
                with HTTP 500 status.
    """
    result = video.convert_mp4_to_mp4(
        req.video_file, req.upload_to_minio, req.video_type
    )
    if isinstance(result, dict) and "error" in result:
        return JSONResponse(content=result, status_code=500)
    return JSONResponse(content=result, status_code=200)


@router.post('/combine-videos', tags=["Combine Videos"])
async def combine_videos(
    req: CombineVideosRequest, background_tasks: BackgroundTasks
):
    """
    Combines multiple MP4 video files into a single video in the background.

    Args:
        req (CombineVideosRequest): Contains 'video_file_name' and 'video_files'.
        background_tasks (BackgroundTasks): FastAPI background task manager.

    Returns:
        Job status including job_id and status.
    """
    job_id, job = video.set_job_status(req.video_file_name, status='pending')
    background_tasks.add_task(
        video.combine_videos,
        req.video_file_name,
        req.video_files,
        req.epoch,
        req.video_type,
        req.upload_to_minio,
    )
    return JSONResponse(respond_job_status(job_id, job))


@router.get('/combine-videos-status/{job_id}', tags=["Combine Videos"])
async def check_video_status(job_id: str):
    """
    Checks the current status of a video combining job.

    Args:
        job_id (str): Unique identifier of the combine-videos job.

    Returns:
        A JSON object containing:
            - job_id (str): The ID of the job
            - status (str): Current job status ('pending', 'completed', 'failed')
            - error (str, optional): Error message if the job failed
            - stderr (str, optional): Detailed ffmpeg stderr output if applicable
    """
    job = video.get_job(job_id)
    return JSONResponse(respond_job_status(job_id, job))


@router.get('/combine-videos-result/{job_id}', tags=["Combine Videos"])
async def get_video_result(job_id: str):
    """
    Retrieves the result of a completed video combining job.

    Args:
        job_id (str): Unique identifier of the combine-videos job.

    Returns:
        JSONResponse:
            - If completed: JSON object with 'file_path' and 'filename' of the
                combined video.
            - If not completed or failed: JSON object containing job status and
                error details.
    """
    job = video.get_job(job_id)
    job_response = respond_job_status(job_id, job)
    if job_response.get('status') == 'completed':
        return JSONResponse(
            {'file_path': str(job['file_path']), 'filename': job['filename']}
        )
    return JSONResponse(job_response)
