import os

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

ADMIN_DB_PATH = os.getenv("ADMIN_DB_PATH", "/app/data/admin.db")
ASYNC_DATABASE_URL = f"sqlite+aiosqlite:///{ADMIN_DB_PATH}"

async_engine = create_async_engine(ASYNC_DATABASE_URL, echo=False)

async_session = sessionmaker(
    async_engine, class_=AsyncSession, expire_on_commit=False
)


async def get_session() -> AsyncSession:
    async with async_session() as session:
        yield session
