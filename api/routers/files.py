import shutil
import subprocess
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse

from paths import ASSET_FILES_DIR
from schemas import CleanupRequest, ExecuteRequest, VideoFileRequest
from .utils import ALL_CLEANABLE_FOLDERS, parse_video_filename, verify_api_key

router = APIRouter(tags=["File Management"], dependencies=[Depends(verify_api_key)])


@router.post('/cleanup')
async def cleanup(req: CleanupRequest):
    """
    Deletes all contents of the specified n8n_files folders.

    Args:
        req (CleanupRequest): Contains an optional 'folders' list. If omitted,
            all cleanable folders are processed.

    Returns:
        JSONResponse:
            - cleaned (list[str]): Folders that were successfully cleared.
            - skipped (list[str]): Folders that were not found on disk.
    """
    folders = req.folders if req.folders is not None else list(ALL_CLEANABLE_FOLDERS)
    invalid = [f for f in folders if f not in ALL_CLEANABLE_FOLDERS]
    if invalid:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid folders: {invalid}. Allowed: {sorted(ALL_CLEANABLE_FOLDERS)}",
        )

    cleaned, skipped = [], []
    for folder in folders:
        folder_path = Path(ASSET_FILES_DIR, folder)
        if not folder_path.is_dir():
            skipped.append(folder)
            continue
        for item in folder_path.iterdir():
            shutil.rmtree(item) if item.is_dir() else item.unlink()
        cleaned.append(folder)

    return JSONResponse({
        "cleaned": cleaned,
        "skipped": skipped
    })


@router.post('/copy-video')
async def copy_video(req: VideoFileRequest):
    """
    Copies a video file from n8n_files root into the appropriate epoch
    subdirectory under video_files.

    The filename must follow the pattern {type}-epoch-{N}_{name}, e.g.
    yt-ch1-epoch-6_slide-1.mp4. The epoch directory is derived automatically.

    Args:
        req (VideoFileRequest): Contains 'filename' of the source file located
            in n8n_files/.

    Returns:
        JSONResponse:
            - file_path (str): Absolute path of the copied file.
            - filename (str): The destination filename.
    """
    try:
        epoch_dir, file_part = parse_video_filename(req.filename)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    source = Path(ASSET_FILES_DIR, req.filename)
    if not source.is_file():
        raise HTTPException(status_code=404, detail=f"File not found: {req.filename}")

    dest_dir = Path(ASSET_FILES_DIR, 'video_files', epoch_dir)
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / file_part
    shutil.copy2(source, dest)

    return JSONResponse({
        "file_path": str(dest),
        "filename": file_part
    })



@router.post('/execute')
async def execute_command(req: ExecuteRequest):
    result = subprocess.run(
        req.command,
        shell=True,
        capture_output=True,
        text=True,
        cwd=req.cwd or None,
    )
    return JSONResponse({
        "stdout": result.stdout,
        "stderr": result.stderr,
        "returnCode": result.returncode,
    })

