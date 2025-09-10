from fastapi import FastAPI, BackgroundTasks, Request, HTTPException
from fastapi.responses import JSONResponse, FileResponse, StreamingResponse
from fastapi.templating import Jinja2Templates
from video_generator import VideoGenerator, PPTGenerator, ImageExtractor
from text_to_voice import TextToVoice
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
PPT_FILES_DIR = Path(BASE_DIR, 'n8n_files', 'ppt_files')
VIDEO_FILES_DIR = Path(BASE_DIR, 'n8n_files', 'video_files')
CHUNK_SIZE = 1024 * 1024 # 1MB

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

app = FastAPI(root_path='/api')
templates = Jinja2Templates(directory="templates")
ttv = TextToVoice()
img_ext = ImageExtractor()
video = VideoGenerator()

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
    response_data = {
        'job_id': job_id,
        'status': job.get('status', 'pending')
    }

    if 'error' in job:
        response_data['error'] = job['error']
    if 'stderr' in job:
        response_data['stderr'] = job['stderr']
    return response_data


def iter_file(file_path: Path, start: int, end: int):
    """
    Generator function to stream a file in chunks for range requests.

    Args:
        file_path (Path): Path of the file to stream.
        start (int): Starting byte position.
        end (int): Ending byte position.

    Yields:
        bytes: A chunk of the file of up to CHUNK_SIZE.
    """
    with file_path.open("rb") as f:
        f.seek(start)
        remaining = end - start + 1
        while remaining > 0:
            chunk_size = min(CHUNK_SIZE, remaining)
            data = f.read(chunk_size)
            if not data:
                break
            yield data
            remaining -= len(data)

@app.post('/vtt-generate-audio-bytes')
async def generate_tts_bytes(req: dict, background_tasks: BackgroundTasks):
    """
    Creates a TTS job to convert text into audio bytes in the background.

    Args:
        req (dict): Request containing 'text' to convert.
        background_tasks (BackgroundTasks): FastAPI background tasks manager.

    Returns:
        Job status containing 'job_id' and current status.
    """
    job_id, job = ttv.set_job_status(status='pending')
    background_tasks.add_task(ttv.generate_tts_job, job_id, req['text'])

    return JSONResponse(respond_job_status(job_id, job))

@app.get('/vtt-status/{job_id}')
async def check_status(job_id: str):
    """
    Checks the current status of a TTS job.

    Args:
        job_id (str): Unique ID of the TTS job.

    Returns:
        Current job status including 'pending', 'completed', or 'failed'.
    """
    job = ttv.get_job(job_id)
    return JSONResponse(respond_job_status(job_id, job))

@app.get('/vtt-result/{job_id}')
async def get_result(job_id: str):
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
            filename=f'{job_id}.wav'
        )
    return JSONResponse(job_response)

@app.post('/ppt-generator')
async def ppt_generator(req: dict):
    """
    Generates PowerPoint slides based on a template and user-specified text
    replacements.

    Args:
        req (dict): Contains 'template_slide', 'old_text', and 'jobs' list for
            slide creation.

    Returns:
        File info including path, name, and total slides created.
    """
    ppt = PPTGenerator()
    ppt.template_slide = int(req['template_slide'])
    ppt.old_text = req['old_text']
    file_path = ppt.create_slide(req['jobs'])

    return JSONResponse({
        'file_name': file_path.name,
        'file_path': str(file_path),
        'total_slides': str(len(req['jobs']))
    })

@app.get('/ppt/{file_name}')
async def ppt_generator(file_name: str):
    """
    Downloads a generated PowerPoint file by name.

    Args:
        file_name (str): Name of the PPTX file to retrieve.

    Returns:
        PowerPoint file or error if not found.
    """
    file_path = Path(PPT_FILES_DIR, f'{file_name}.pptx')
    if not file_path.exists():
        return {'error': 'File not found'}

    return FileResponse(
        path=str(file_path),
        media_type='application/vnd.openxmlformats-officedocument.presentationml.presentation',
        filename=file_path.name
    )

@app.post("/extract-slides")
async def extract_slides(req: dict, background_tasks: BackgroundTasks):
    """
    Extracts slides from a PowerPoint file as images in the background.

    Args:
        req (dict): Contains 'file_name', 'total_slides', and optional
            'batch_size'.
        background_tasks (BackgroundTasks): FastAPI background task manager.

    Returns:
        Job status with 'pending', 'completed', or 'failed'.
    """
    file_name = req["file_name"]
    total_slides = int(req["total_slides"])
    batch_size = req.get("batch_size", -1)
    _, job = img_ext.set_job_status(file_name, status='pending')
    background_tasks.add_task(
        img_ext.extract_slides,
        file_name,
        total_slides,
        batch_size
    )

    return JSONResponse(respond_job_status(file_name, job))

@app.get('/img-ext-status/{job_id}')
async def check_status(job_id: str):
    """
    Checks the current status of an image extraction job from a PowerPoint file.

    Args:
        job_id (str): Unique identifier of the image extraction job.

    Returns:
        A JSON object containing:
            - job_id (str): The ID of the job
            - status (str): Current job status ('pending', 'completed', 'failed')
            - error (str, optional): Error message if the job failed
            - stderr (str, optional): Additional error details if available
    """
    job = img_ext.get_job(job_id)
    return JSONResponse(respond_job_status(job_id, job))

@app.get('/img-ext-result/{job_id}')
async def get_result(job_id: str):
    """
    Retrieves the result of a completed image extraction job.

    Args:
        job_id (str): Unique identifier of the image extraction job.

    Returns:
        JSONResponse:
            - If completed: JSON object containing 'slides' list along with job status.
            - If not completed or failed: JSON object containing current job status and error details.
    """
    job = img_ext.get_job(job_id)
    job_response = respond_job_status(job_id, job)

    if job_response.get('status') == 'completed':
        return JSONResponse({
            **job_response,
            'slides': job.get('slides')
        })
    return JSONResponse(job_response)

@app.post("/convert-to-mp4")
async def convert_to_mp4(req: dict, background_tasks: BackgroundTasks):
    """
    Convert an image and audio file into an MP4 video in the background.

    Args:
        req (dict): Contains 'image_file' and 'audio_file'.
        background_tasks (BackgroundTasks): FastAPI background task manager.

    Returns:
        Job status including job_id and status.
    """
    image_file = req["image_file"]
    job_id, job = video.set_job_status(
        f'{image_file.split('.')[0]}-img',
        status='pending'
    )
    background_tasks.add_task(
        video.convert_to_mp4,
        job_id,
        image_file,
        req["audio_file"]
    )

    return JSONResponse(respond_job_status(job_id, job))

@app.get('/convert-to-mp4-status/{job_id}')
async def check_status(job_id: str):
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
        return JSONResponse({
            'status': 'completed',
            'file_path': str(job['video_file']),
            'filename': job['filename']
        })
    return JSONResponse(job_response)

@app.post("/convert-mp4-to-mp4")
async def convert_to_mp4(req: dict):
    """
    Convert an existing MP4 video to a standardized MP4 format using ffmpeg.

    Args:
        req (dict): Request payload containing:
            - video_file (str): Name of the MP4 file to convert

    Returns:
        JSONResponse:
            - If successful: JSON object with 'video_file' path and 'filename'.
            - If failed: JSON object containing 'error' and optional 'stderr'
                with HTTP 500 status.
    """
    result = video.convert_mp4_to_mp4(req["video_file"])

    if isinstance(result, dict) and "error" in result:
        return JSONResponse(content=result, status_code=500)
    return JSONResponse(content=result, status_code=200)

@app.post("/combine-videos")
async def combine_videos(req: dict, background_tasks: BackgroundTasks):
    """
    Combines multiple MP4 video files into a single video in the background.

    Args:
        req (dict): Contains 'video_file_name' and list of 'video_files'.
        background_tasks (BackgroundTasks): FastAPI background task manager.

    Returns:
        Job status including job_id and status.
    """
    file_name = req["video_file_name"]
    job_id, job = video.set_job_status(file_name, status='pending')
    background_tasks.add_task(
        video.combine_videos,
        file_name,
        req["video_files"]
    )

    return JSONResponse(respond_job_status(job_id, job))

@app.get('/combine-videos-status/{job_id}')
async def check_status(job_id: str):
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

@app.get('/combine-videos-result/{job_id}')
async def get_result(job_id: str):
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
        return JSONResponse({
            'file_path': str(job['file_path']),
            'filename': job['filename']
        })
    return JSONResponse(job_response)

@app.get("/video/{video_id}")
async def video_page(request: Request, video_id: str):
    """
    Renders a HTML page containing a video player for the specified video.

    Args:
        request (Request): FastAPI Request object.
        video_id (str): Unique identifier of the video file.

    Returns:
        HTML page with embedded video player.
    """
    video_path = Path(VIDEO_FILES_DIR, f'{video_id}.mp4')

    if not video_path.exists():
        raise HTTPException(status_code=404, detail="Video not found")
    return templates.TemplateResponse(
        "video.jinja",
        {"request": request, "video_id": video_id}
    )

@app.get("/get-video/{video_id}")
async def video_endpoint(request: Request, video_id: str):
    """
    Streams video content to the client with support for HTTP Range requests.

    Args:
        request (Request): FastAPI Request object.
        video_id (str): Name of the video file to stream.

    Returns:
        StreamingResponse: Video content stream supporting partial content
            delivery.
    """
    video_path = Path(VIDEO_FILES_DIR, f"{video_id}.mp4")

    if not video_path.exists():
        raise HTTPException(status_code=404, detail="Video not found")

    file_size = video_path.stat().st_size
    range_header = request.headers.get("range")

    if range_header:
        byte1, byte2 = range_header.replace("bytes=", "").split("-")
        start = int(byte1)
        end = int(byte2) if byte2 else file_size - 1
    else:
        start = 0
        end = file_size - 1

    chunk_size = end - start + 1

    headers = {
        "Content-Range": f"bytes {start}-{end}/{file_size}",
        "Accept-Ranges": "bytes",
        "Content-Length": str(chunk_size),
        "Content-Type": "video/mp4",
    }

    return StreamingResponse(
        iter_file(video_path, start, end), status_code=206, headers=headers
    )