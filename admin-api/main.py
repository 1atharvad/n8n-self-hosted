import os
from contextlib import asynccontextmanager
from typing import List

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import redis.asyncio as aioredis

from auth.router import router as auth_router
from db.crud import seed_admin_if_empty
from db.database import async_engine, async_session
from routes import router


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with async_session() as session:
        await seed_admin_if_empty(session)

    redis_host = os.getenv("REDIS_HOST", "redis")
    redis_port = int(os.getenv("REDIS_PORT", 6379))
    app.state.redis = aioredis.Redis(host=redis_host, port=redis_port, decode_responses=True)

    yield

    await app.state.redis.aclose()
    await async_engine.dispose()


app = FastAPI(root_path='/api/logs', lifespan=lifespan)

_raw_origins = os.getenv("CORS_ORIGINS", "")
_allow_origins: List[str] = [o.strip() for o in _raw_origins.split(",") if o.strip()] or ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allow_origins,
    allow_methods=['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allow_headers=['Authorization', 'Content-Type', '*'],
)

app.include_router(router)
app.include_router(auth_router, prefix="/auth")
