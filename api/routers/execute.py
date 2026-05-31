import subprocess

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from schemas import ExecuteRequest
from .utils import verify_api_key

router = APIRouter(tags=["File Management"], dependencies=[Depends(verify_api_key)])


@router.post('/execute')
async def execute_command(req: ExecuteRequest):
    result = subprocess.run(
        req.command,
        shell=True,
        capture_output=True,
        text=True,
    )
    return JSONResponse({
        "stdout": result.stdout,
        "stderr": result.stderr,
        "returnCode": result.returncode,
    })

