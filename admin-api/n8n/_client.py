import json
import os

import httpx
from fastapi import HTTPException

N8N_BASE = os.getenv("N8N_BASE_URL", "http://n8n:5678")
N8N_API_KEY = os.getenv("N8N_API_KEY", "")


async def _n8n(method: str, path: str, body: dict | None = None):
    headers = {"X-N8N-API-KEY": N8N_API_KEY}
    if body is not None:
        headers["Content-Type"] = "application/json"
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.request(
            method,
            f"{N8N_BASE}/api/v1{path}",
            headers=headers,
            content=json.dumps(body).encode() if body is not None else None,
        )
    if not resp.is_success:
        raise HTTPException(status_code=resp.status_code, detail=f"n8n: {resp.text[:200]}")
    return resp.json() if resp.content else None
