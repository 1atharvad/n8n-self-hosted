import os
from contextlib import asynccontextmanager
from typing import List

from fastapi import FastAPI, Request
from sqlalchemy import text
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import redis.asyncio as aioredis
from slowapi.errors import RateLimitExceeded
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from auth.router import router as auth_router
from limiter import limiter
from db.crud import seed_admin_if_empty
from db.database import async_engine, async_session
from db.models import Base
from backups import router as backups_router
from env import router as env_router
from n8n import router as n8n_router
from logs import router, audit_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        try:
            await conn.execute(text("ALTER TABLE audit_log ADD COLUMN ip_address VARCHAR(45)"))
        except Exception as e:
            if "duplicate column" not in str(e).lower() and "already exists" not in str(e).lower():
                raise

    async with async_session() as session:
        await seed_admin_if_empty(session)

    redis_host = os.getenv("REDIS_HOST", "redis")
    redis_port = int(os.getenv("REDIS_PORT", 6379))
    app.state.redis = aioredis.Redis(host=redis_host, port=redis_port, decode_responses=True)

    yield

    await app.state.redis.aclose()
    await async_engine.dispose()


app = FastAPI(root_path='/api/admin', lifespan=lifespan)
app.state.limiter = limiter

@app.exception_handler(RateLimitExceeded)
async def _rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(status_code=429, content={"detail": "Too many requests — slow down."})

_raw_origins = os.getenv("CORS_ORIGINS", "")
_allow_origins: List[str] = [o.strip() for o in _raw_origins.split(",") if o.strip()] or ["*"]

app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="*")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allow_origins,
    allow_methods=['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allow_headers=['Authorization', 'Content-Type', '*'],
)

app.include_router(router)
app.include_router(audit_router)
app.include_router(auth_router, prefix="/auth")
app.include_router(n8n_router)
app.include_router(env_router)
app.include_router(backups_router)
