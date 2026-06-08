import os

from fastapi import HTTPException, Security
from fastapi.security import APIKeyHeader

_api_key_header = APIKeyHeader(name="X-API-Key")


def verify_api_key(key: str = Security(_api_key_header)):
    expected = os.environ.get("API_KEY")
    if not expected:
        raise HTTPException(status_code=500, detail="API_KEY not configured")
    if key != expected:
        raise HTTPException(status_code=401, detail="Invalid API key")


def respond_job_status(job_id, job):
    if not job:
        return {'error': 'Job not found', 'status': 'failed'}
    response_data = {'job_id': job_id, 'status': job.get('status', 'pending')}
    if 'error' in job:
        response_data['error'] = job['error']
    if 'stderr' in job:
        response_data['stderr'] = job['stderr']
    return response_data
