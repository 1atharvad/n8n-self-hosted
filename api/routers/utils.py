import os
from pathlib import Path

from fastapi import HTTPException, Security
from fastapi.security import APIKeyHeader

_api_key_header = APIKeyHeader(name="X-API-Key")

def verify_api_key(key: str = Security(_api_key_header)):
    expected = os.environ.get("API_KEY")
    if not expected:
        raise HTTPException(status_code=500, detail="API_KEY not configured")
    if key != expected:
        raise HTTPException(status_code=401, detail="Invalid API key")

BASE_DIR = Path(__file__).resolve().parent.parent.parent
ASSET_FILES_DIR = Path(BASE_DIR, 'n8n_files')
PPT_FILES_DIR = Path(ASSET_FILES_DIR, 'ppt_files')

ALL_CLEANABLE_FOLDERS = {"video_files", "pdf_files", "ppt_files", "ppt_images", "audio_files"}


def respond_job_status(job_id, job):
    if not job:
        return {'error': 'Job not found', 'status': 'failed'}
    response_data = {'job_id': job_id, 'status': job.get('status', 'pending')}
    if 'error' in job:
        response_data['error'] = job['error']
    if 'stderr' in job:
        response_data['stderr'] = job['stderr']
    return response_data


def parse_video_filename(filename: str) -> tuple[str, str]:
    """Parse {type}-epoch-{N}_{rest} into (epoch_dir, file_part). e.g. yt-ch1-epoch-6_slide.mp4 → (yt-ch1-epoch_6, slide.mp4)"""
    if '_' not in filename:
        raise ValueError(f"Filename must follow format {{type}}-epoch-<N>_<name>, got: {filename}")
    epoch_part, file_part = filename.split('_', 1)
    last_dash = epoch_part.rfind('-')
    epoch_dir = epoch_part[:last_dash] + '_' + epoch_part[last_dash + 1:]
    return epoch_dir, file_part
