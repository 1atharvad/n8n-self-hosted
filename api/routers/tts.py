from fastapi import APIRouter, BackgroundTasks
from fastapi.responses import FileResponse, JSONResponse

from audio_manager import TextToVoice
from schemas import TTSRequest
from .utils import respond_job_status

router = APIRouter(tags=["Text to Audio"])
ttv = TextToVoice()


@router.post('/vtt-generate-audio-bytes')
async def generate_tts_bytes(req: TTSRequest, background_tasks: BackgroundTasks):
    """
    Creates a TTS job to convert text into audio bytes in the background.

    Args:
        req (TTSRequest): Request containing 'text' to convert.
        background_tasks (BackgroundTasks): FastAPI background tasks manager.

    Returns:
        Job status containing 'job_id' and current status.
    """
    job_id, job = ttv.set_job_status(status='pending')
    background_tasks.add_task(ttv.generate_tts_job, job_id, req.text)
    return JSONResponse(respond_job_status(job_id, job))


@router.get('/vtt-status/{job_id}')
async def check_vtt_status(job_id: str):
    """
    Checks the current status of a TTS job.

    Args:
        job_id (str): Unique ID of the TTS job.

    Returns:
        Current job status including 'pending', 'completed', or 'failed'.
    """
    job = ttv.get_job(job_id)
    return JSONResponse(respond_job_status(job_id, job))


@router.get('/vtt-result/{job_id}')
async def get_vtt_result(job_id: str):
    """
    Retrieve the resulting TTS audio file if the job is completed.

    Args:
        job_id (str): Unique ID of the TTS job.

    Returns:
        WAV audio file or error/status info.
    """
    job = ttv.get_job(job_id)
    job_response = respond_job_status(job_id, job)
    if job_response.get('status') == 'completed':
        return FileResponse(
            path=str(job['file_path']),
            media_type='audio/wav',
            filename=f'{job_id}.wav',
        )
    return JSONResponse(job_response)
