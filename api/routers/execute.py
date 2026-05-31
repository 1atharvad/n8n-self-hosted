import subprocess

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from schemas import ExecuteRequest

router = APIRouter(tags=["File Management"])


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

