import os
import urllib.parse

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

load_dotenv()

POSTGRES_USER = os.getenv("POSTGRES_USER")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD")
POSTGRES_DB = os.getenv("POSTGRES_DB")
POSTGRES_PORT = os.getenv("POSTGRES_PORT")
POSTGRES_PASSWORD_ENCODED = urllib.parse.quote_plus(POSTGRES_PASSWORD)

ASYNC_DATABASE_URL = f"postgresql+asyncpg://{POSTGRES_USER}:{POSTGRES_PASSWORD_ENCODED}@postgres:{POSTGRES_PORT}/{POSTGRES_DB}"
async_engine = create_async_engine(ASYNC_DATABASE_URL, echo=True)

async_session = sessionmaker(
    async_engine, class_=AsyncSession, expire_on_commit=False
)

# Sync engine for SQLAdmin
SYNC_DATABASE_URL = f"postgresql+psycopg2://{POSTGRES_USER}:{POSTGRES_PASSWORD_ENCODED}@postgres:{POSTGRES_PORT}/{POSTGRES_DB}"
sync_engine = create_engine(SYNC_DATABASE_URL, echo=True)
