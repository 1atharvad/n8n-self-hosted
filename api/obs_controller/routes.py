import asyncio
import os

from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.templating import Jinja2Templates

from .show_runner import ShowRunner

API_KEY = os.getenv("API_KEY", "")

templates = Jinja2Templates(directory="templates")
router = APIRouter()
sr = ShowRunner()

"""
    FastAPI API endpoints for controlling OBS shows and recordings.

    Features:
        - Start/stop recording and streaming sessions.
        - Add new videos to an ongoing show.
        - Serve advertisement pages via Jinja2 templates.

    Security:
        - All endpoints require a valid `x-api-key` header.
"""


@router.post("/start-stream")
async def start_obs_stream(request: Request, x_api_key: str = Header(None)):
    """
    Start an OBS streaming session for a specific show.

    Args:
        request (Request): FastAPI request object, expecting JSON with optional fields:
            - show_id (str): Identifier of the show (required)
            - max_duration (int): Maximum stream duration in seconds (default 3600)
            - video_list (list): List of video files to queue for playback
        x_api_key (str): API key for authentication (Header)

    Returns:
        dict: Status message confirming stream has started

    Raises:
        HTTPException: If API key is invalid or show_id is missing
    """
    if x_api_key != API_KEY:
        raise HTTPException(status_code=403, detail="Invalid API key")

    try:
        data = await request.json()
    except Exception:
        data = {}
    show_id = data.get("show_id", "")
    if show_id == "":
        raise HTTPException(status_code=403, detail="Show ID not provided")

    max_duration = data.get("max_duration", 3600)
    video_list = data.get("video_list", [])
    asyncio.create_task(sr.run_show(show_id, max_duration, video_list))
    return {"status": "OBS stream started"}


@router.post("/add-new-video")
async def add_new_video_in_obs(
    request: Request, x_api_key: str = Header(None)
):
    """
    Add a new video to the currently running OBS show queue.

    Args:
        request (Request): FastAPI request object, expecting JSON with:
            - video_name (str): Name of the video to add
        x_api_key (str): API key for authentication (Header)

    Returns:
        dict: Status message confirming the video has been added

    Raises:
        HTTPException: If API key is invalid, stream is not running, or video_name is missing
    """
    if x_api_key != API_KEY:
        raise HTTPException(status_code=403, detail="Invalid API key")

    if not sr.is_running:
        raise HTTPException(
            status_code=403, detail="Stream not started, try again later"
        )

    try:
        data = await request.json()
    except Exception:
        data = {}
    video_name = data.get("video_name")

    if not video_name:
        raise HTTPException(status_code=400, detail="Missing 'video_name'")

    asyncio.create_task(sr.add_new_video_in_show(video_name))
    return {"status": "New video added in stream"}


@router.post("/stop-stream")
async def stop_obs_stream(x_api_key: str = Header(None)):
    """
    Stop the currently running OBS stream or recording session.

    Args:
        x_api_key (str): API key for authentication (Header)

    Returns:
        dict: Status message confirming the stream/recording has been stopped

    Raises:
        HTTPException: If API key is invalid
    """
    if x_api_key != API_KEY:
        raise HTTPException(status_code=403, detail="Invalid API key")

    asyncio.create_task(sr.stop_show())
    return {"status": "OBS stream stopped"}


@router.get("/advertisement/{ad_file_name}")
async def video_page(request: Request, ad_file_name: str):
    return templates.TemplateResponse(
        "ad_file.jinja", {"request": request, "ad_file_name": ad_file_name}
    )
