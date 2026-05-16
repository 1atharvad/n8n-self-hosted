import os
from pathlib import Path

from fastapi import BackgroundTasks, FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

import httpx

from admin.admin_app import init_admin
from audio_manager import SpeechToText, TextToVoice as AudioTTS
from audio_manager.speech_to_text import VADStream
from schemas import (
    CombineVideosRequest,
    ConvertMp4Request,
    ConvertToMp4Request,
    ExtractSlidesRequest,
    PPTRequest,
    TTSRequest,
)
from video_generator import (
    ImageExtractor,
    PPTGenerator,
    TextToVoice,
    VideoGenerator,
)

BASE_DIR = Path(__file__).resolve().parent.parent
ASSET_FILES_DIR = Path(BASE_DIR, 'n8n_files')
PPT_FILES_DIR = Path(ASSET_FILES_DIR, 'ppt_files')
VIDEO_FILES_DIR = Path(ASSET_FILES_DIR, 'video_files')

"""
FastAPI Application for TTS, PPT, Image Extraction, and Video Generation.

This API provides endpoints to:
    - Convert text to speech (TTS)
    - Generate PowerPoint slides from templates
    - Extract slides from PPT files as images
    - Convert images and audio to MP4 videos
    - Combine multiple MP4 videos into a single video
    - Serve videos with support for partial content streaming

Modules Used:
    - FastAPI for web API routing and background tasks
    - Jinja2 for HTML templating
    - VideoGenerator, PPTGenerator, ImageExtractor, TextToVoice for media
        processing
"""

app = FastAPI(root_path='/api/core')
app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="*")
ttv = TextToVoice()
img_ext = ImageExtractor()
video = VideoGenerator()
stt = SpeechToText()
audio_tts = AudioTTS()


init_admin(app)



def respond_job_status(job_id, job):
    """
    Helper function to structure job status responses.

    Args:
        job_id (str): The unique ID of the job.
        job (dict | None): Job metadata stored in the relevant class instance.

    Returns:
        Job status information, including 'status', 'error', and 'stderr' if
            applicable.
    """
    if not job:
        return {'error': 'Job not found', 'status': 'failed'}
    response_data = {'job_id': job_id, 'status': job.get('status', 'pending')}

    if 'error' in job:
        response_data['error'] = job['error']
    if 'stderr' in job:
        response_data['stderr'] = job['stderr']
    return response_data



@app.post('/vtt-generate-audio-bytes', tags=["Text to Audio"])
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


@app.get('/vtt-status/{job_id}', tags=["Text to Audio"])
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


@app.get('/vtt-result/{job_id}', tags=["Text to Audio"])
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


@app.post('/ppt-generator', tags=["Image Generator"])
async def ppt_generator(req: PPTRequest):
    """
    Generates PowerPoint slides based on a template and user-specified text
    replacements.

    Args:
        req (PPTRequest): Contains 'template_slide', 'old_text', and 'jobs'
            list for slide creation.

    Returns:
        File info including path, name, and total slides created.
    """
    ppt = PPTGenerator(req.template_file)
    ppt.template_slide = req.template_slide
    ppt.old_text = req.old_text
    file_path = ppt.create_slide(req.jobs)

    return JSONResponse(
        {
            'file_name': file_path.name,
            'file_path': str(file_path),
            'total_slides': str(len(req.jobs)),
        }
    )


@app.get('/ppt/{file_name}', tags=["Image Generator"])
async def get_ppt_file(file_name: str):
    """
    Downloads a generated PowerPoint file by name.

    Args:
        file_name (str): Name of the PPTX file to retrieve.

    Returns:
        PowerPoint file or error if not found.
    """
    file_path = Path(PPT_FILES_DIR, f'{file_name}.pptx')
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(
        path=str(file_path),
        media_type='application/vnd.openxmlformats-officedocument.presentationml.presentation',
        filename=file_path.name,
    )


@app.post("/extract-slides", tags=["Image Generator"])
async def extract_slides(req: ExtractSlidesRequest, background_tasks: BackgroundTasks):
    """
    Extracts slides from a PowerPoint file as images in the background.

    Args:
        req (ExtractSlidesRequest): Contains 'file_name', 'start_slide',
            'end_slide', and 'total_slides'.
        background_tasks (BackgroundTasks): FastAPI background task manager.

    Returns:
        Job status with 'pending', 'completed', or 'failed'.
    """
    _, job = img_ext.set_job_status(req.file_name, status='pending')
    background_tasks.add_task(
        img_ext.extract_slides, req.file_name, req.start_slide, req.end_slide, req.total_slides, req.epoch, req.video_type
    )

    return JSONResponse(respond_job_status(req.file_name, job))


@app.get('/img-ext-status/{job_id}', tags=["Image Generator"])
async def check_img_status(job_id: str):
    """
    Checks the current status of an image extraction job from a PowerPoint file.

    Args:
        job_id (str): Unique identifier of the image extraction job.

    Returns:
        A JSON object containing:
            - job_id (str): The ID of the job
            - status (str): Current job status ('pending', 'completed',
                'failed')
            - error (str, optional): Error message if the job failed
            - stderr (str, optional): Additional error details if available
    """
    job = img_ext.get_job(job_id)
    return JSONResponse(respond_job_status(job_id, job))


@app.get('/img-ext-result/{job_id}', tags=["Image Generator"])
async def get_img_result(job_id: str):
    """
    Retrieves the result of a completed image extraction job.

    Args:
        job_id (str): Unique identifier of the image extraction job.

    Returns:
        JSONResponse:
            - If completed: JSON object containing 'slides' list along with job
                status.
            - If not completed or failed: JSON object containing current job
                status and error details.
    """
    job = img_ext.get_job(job_id)
    job_response = respond_job_status(job_id, job)

    if job_response.get('status') == 'completed':
        return JSONResponse({**job_response, 'slides': job.get('slides')})
    return JSONResponse(job_response)


@app.post("/convert-to-mp4", tags=["Video Generator"])
async def convert_to_mp4(req: ConvertToMp4Request, background_tasks: BackgroundTasks):
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
        video.convert_to_mp4, job_id, req.image_file, req.audio_file, req.epoch, req.video_type, req.upload_to_minio
    )

    return JSONResponse(respond_job_status(job_id, job))


@app.get('/convert-to-mp4-status/{job_id}', tags=["Video Generator"])
async def check_mp4_status(job_id: str):
    """
    Check the current status of an image-to-MP4 video conversion job.

    Args:
        job_id (str): Unique identifier of the convert-to-MP4 job.

    Returns:
        A JSON object containing:
            - job_id (str): The ID of the job
            - status (str): Current job status ('pending', 'completed',
                'failed')
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


@app.post("/convert-mp4-to-mp4", tags=["Video Generator"])
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
    result = video.convert_mp4_to_mp4(req.video_file, req.upload_to_minio)

    if isinstance(result, dict) and "error" in result:
        return JSONResponse(content=result, status_code=500)
    return JSONResponse(content=result, status_code=200)


@app.post("/combine-videos", tags=["Combine Videos"])
async def combine_videos(req: CombineVideosRequest, background_tasks: BackgroundTasks):
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
        video.combine_videos, req.video_file_name, req.video_files, req.epoch, req.video_type, req.upload_to_minio
    )

    return JSONResponse(respond_job_status(job_id, job))


@app.get('/combine-videos-status/{job_id}', tags=["Combine Videos"])
async def check_video_status(job_id: str):
    """
    Checks the current status of a video combining job.

    Args:
        job_id (str): Unique identifier of the combine-videos job.

    Returns:
        A JSON object containing:
            - job_id (str): The ID of the job
            - status (str): Current job status ('pending', 'completed',
                'failed')
            - error (str, optional): Error message if the job failed
            - stderr (str, optional): Detailed ffmpeg stderr output if
                applicable
    """
    job = video.get_job(job_id)
    return JSONResponse(respond_job_status(job_id, job))


@app.get('/combine-videos-result/{job_id}', tags=["Combine Videos"])
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


# ---------------------------------------------------------------------------
# Live AI voice chat — WebSocket
# ---------------------------------------------------------------------------
# Binary protocol (per frame):
#   Flutter → server : raw 16 kHz 16-bit mono PCM chunks (~100 ms each)
#   server → Flutter : WAV audio chunks, one per TTS sentence
#
# Flow per utterance:
#   PCM chunks → VAD detects end-of-speech → Whisper STT
#   → n8n LLM webhook → Kokoro TTS streamed sentence by sentence → Flutter
#
# N8N_WEBHOOK_URL: set via env var or replace inline.
# ---------------------------------------------------------------------------

N8N_BASE_URL = os.getenv("N8N_WEBHOOK_BASE_URL", "http://n8n:5678/webhook")
DEFAULT_WEBHOOK_ID = "voice-chat"


@app.websocket("/ws/voice-chat")
async def voice_chat(
    websocket: WebSocket,
    webhook_id: str = DEFAULT_WEBHOOK_ID,
):
    await websocket.accept()
    vad = VADStream()
    webhook_url = f"{N8N_BASE_URL}/{webhook_id}"

    try:
        while True:
            # 1. Receive raw PCM chunk from Flutter
            pcm_chunk = await websocket.receive_bytes()

            # 2. VAD — accumulate until end-of-speech detected
            utterance_pcm = vad.process(pcm_chunk)
            if utterance_pcm is None:
                continue

            # 3. Speech → Text (runs Whisper in thread pool)
            user_text = await stt.transcribe_pcm_async(utterance_pcm)
            if not user_text:
                continue

            # 4. AI response via n8n
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    webhook_url,
                    json={"text": user_text},
                    timeout=30,
                )
            ai_response = resp.json().get("response", "")
            if not ai_response:
                continue

            # 5. Stream TTS back sentence by sentence — Flutter plays as it arrives
            for wav_chunk in audio_tts.synthesize_stream(ai_response):
                await websocket.send_bytes(wav_chunk)

    except WebSocketDisconnect:
        pass
