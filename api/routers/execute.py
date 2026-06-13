import asyncio
import os
import re
import shlex
import tempfile

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from schemas import ExecuteRequest

router = APIRouter(tags=["File Management"])

_SH_FILES_DIR = "/sh_files/"
_INTERPRETERS = {"sh", "bash", "python", "python3", "node", "ruby", "perl"}

_BLOCKED_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    # Subshell / substitution
    (re.compile(r"\$\("), "subshell substitution"),
    (re.compile(r"`"), "backtick substitution"),
    # Recursive delete (short and long form)
    (
        re.compile(
            r"\brm\b[^;&|\n]*(-[a-zA-Z]*[rR]|--recursive|--no-preserve-root)"
        ),
        "recursive delete",
    ),
    # Disk destruction
    (re.compile(r"\bdd\b[^;&|\n]*\bof\s*=\s*/dev/"), "write to block device"),
    (re.compile(r"\bmkfs\b"), "filesystem format"),
    (re.compile(r"\bshred\b"), "destructive shred"),
    # Docker — block run and exec regardless of flags (host has docker.sock mounted)
    (
        re.compile(r"\bdocker\b[^;&|\n]*\b(run|exec)\b"),
        "docker run/exec not allowed",
    ),
    # System control
    (
        re.compile(r"\b(shutdown|reboot|halt|poweroff)\b"),
        "system power control",
    ),
    (re.compile(r"\binit\s+[06]\b"), "system shutdown via init"),
    # Kill all
    (re.compile(r"\bkill\b[^;&|\n]*\s+-1\b"), "kill all processes"),
    (re.compile(r"\bpkill\b[^;&|\n]*-9\b"), "force-kill all processes"),
    # Download and execute
    (
        re.compile(r"\b(curl|wget)\b[^;&|\n]*\|[^;&|\n]*(ba)?sh\b"),
        "download-and-execute",
    ),
    (
        re.compile(r"\bbase64\b[^;&|\n]*\|[^;&|\n]*(ba)?sh\b"),
        "encoded execute",
    ),
    # Code execution
    (re.compile(r"\beval\b"), "eval execution"),
    # Overwrite sensitive files
    (
        re.compile(r">\s*/etc/(passwd|shadow|sudoers|hostname|hosts)\b"),
        "overwrite system file",
    ),
    (re.compile(r">\s*/root/\.ssh/"), "overwrite SSH credentials"),
    # Privilege escalation
    (re.compile(r"\bsudo\b"), "sudo not allowed"),
    (re.compile(r"\bchmod\b[^;&|\n]*\+s\b"), "setuid/setgid not allowed"),
    # Misc
    (re.compile(r":\s*\(\s*\)\s*\{"), "fork bomb"),
    (re.compile(r"\biptables\b[^;&|\n]*\s-F\b"), "flush firewall rules"),
    (re.compile(r"\bufw\s+disable\b"), "disable firewall"),
    (re.compile(r"\bcrontab\s+-r\b"), "wipe all crontabs"),
    (re.compile(r"\bnc\b[^;&|\n]*-e\b"), "netcat reverse shell"),
]

# Script mode drops $() and backtick checks — normal bash constructs in scripts.
# All destructive/escalation patterns still apply.
_BLOCKED_SCRIPT_PATTERNS = [
    p
    for p in _BLOCKED_PATTERNS
    if p[1] not in ("subshell substitution", "backtick substitution")
]


def _validate_command(command: str) -> list[str]:
    try:
        parts = shlex.split(command)
    except ValueError as e:
        raise HTTPException(
            status_code=400, detail=f"Invalid command syntax: {e}"
        ) from e

    if not parts:
        raise HTTPException(status_code=400, detail="Empty command")

    executable = parts[0]

    if executable.startswith("/") or executable.startswith("./"):
        if not executable.startswith(_SH_FILES_DIR):
            raise HTTPException(
                status_code=403,
                detail=f"Script execution is only allowed from {_SH_FILES_DIR}",
            )

    if executable in {
        "env",
        "xargs",
        "find",
        "nohup",
        "nice",
        "ionice",
        "timeout",
    }:
        raise HTTPException(
            status_code=403,
            detail=f"Wrapper command '{executable}' is not allowed",
        )

    if executable in _INTERPRETERS:
        for part in parts[1:]:
            if part == "-c":
                raise HTTPException(
                    status_code=403,
                    detail="Interpreter -c flag is not allowed; use a script in /sh_files/ instead",
                )
            if (
                part.startswith("/") or part.startswith("./")
            ) and not part.startswith(_SH_FILES_DIR):
                raise HTTPException(
                    status_code=403,
                    detail=f"Script execution is only allowed from {_SH_FILES_DIR}",
                )

    for pattern, reason in _BLOCKED_PATTERNS:
        if pattern.search(command):
            raise HTTPException(status_code=403, detail=f"Blocked: {reason}")

    return parts


def _validate_script(script: str) -> None:
    for pattern, reason in _BLOCKED_SCRIPT_PATTERNS:
        if pattern.search(script):
            raise HTTPException(status_code=403, detail=f"Blocked: {reason}")


@router.post('/execute')
async def execute_command(req: ExecuteRequest):
    if req.script is not None:
        _validate_script(req.script)
        fd, tmp_path = tempfile.mkstemp(suffix=".sh", dir="/tmp")
        try:
            with os.fdopen(fd, "w") as f:
                f.write(req.script)
            proc = await asyncio.create_subprocess_exec(
                "bash",
                tmp_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await proc.communicate()
        finally:
            os.unlink(tmp_path)
    else:
        parts = _validate_command(req.command)  # type: ignore[arg-type]
        proc = await asyncio.create_subprocess_exec(
            *parts,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()

    output = "\n".join(
        filter(None, [stdout.decode().strip(), stderr.decode().strip()])
    )
    status_code = 200 if proc.returncode == 0 else 500
    return JSONResponse(
        {"output": output, "returnCode": proc.returncode},
        status_code=status_code,
    )
