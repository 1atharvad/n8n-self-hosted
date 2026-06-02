import os
import urllib.parse

from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

load_dotenv()

POSTGRES_USER = os.getenv("POSTGRES_USER")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD")
POSTGRES_DB = os.getenv("POSTGRES_DB")
POSTGRES_PORT = os.getenv("POSTGRES_PORT", "5432")
POSTGRES_PASSWORD_ENCODED = urllib.parse.quote_plus(POSTGRES_PASSWORD)

ASYNC_DATABASE_URL = (
    f"postgresql+asyncpg://{POSTGRES_USER}:{POSTGRES_PASSWORD_ENCODED}"
    f"@postgres:{POSTGRES_PORT}/{POSTGRES_DB}"
)

async_engine = create_async_engine(ASYNC_DATABASE_URL, echo=False)

async_session = sessionmaker(
    async_engine, class_=AsyncSession, expire_on_commit=False
)


async def get_session() -> AsyncSession:
    async with async_session() as session:
        yield session
