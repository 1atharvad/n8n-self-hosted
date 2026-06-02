import os
import uuid
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.security import hash_password
from db.models import User


async def get_user_by_username(session: AsyncSession, username: str) -> Optional[User]:
    result = await session.execute(select(User).where(User.username == username))
    return result.scalar_one_or_none()


async def get_user_by_id(session: AsyncSession, user_id: uuid.UUID) -> Optional[User]:
    result = await session.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def list_users(session: AsyncSession) -> list[User]:
    result = await session.execute(select(User).order_by(User.created_at))
    return list(result.scalars().all())


async def create_user(
    session: AsyncSession,
    username: str,
    password: str,
    role: str = "viewer",
    allowed_containers: Optional[list[str]] = None,
) -> User:
    user = User(
        username=username,
        hashed_password=hash_password(password),
        role=role,
        allowed_containers=allowed_containers,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


async def update_user(
    session: AsyncSession,
    user: User,
    role: Optional[str] = None,
    allowed_containers: Optional[list[str]] | str = "UNCHANGED",
    is_active: Optional[bool] = None,
    password: Optional[str] = None,
) -> User:
    if role is not None:
        user.role = role
    if allowed_containers != "UNCHANGED":
        user.allowed_containers = allowed_containers
    if is_active is not None:
        user.is_active = is_active
    if password is not None:
        user.hashed_password = hash_password(password)
    await session.commit()
    await session.refresh(user)
    return user


async def delete_user(session: AsyncSession, user: User) -> None:
    await session.delete(user)
    await session.commit()


async def seed_admin_if_empty(session: AsyncSession) -> None:
    result = await session.execute(select(func.count()).select_from(User))
    count = result.scalar()
    if count and count > 0:
        return

    username = os.getenv("LOGS_ADMIN_USERNAME", "admin")
    password = os.getenv("LOGS_ADMIN_PASSWORD")
    if not password:
        raise RuntimeError(
            "LOGS_ADMIN_PASSWORD env var is required for initial admin seed"
        )

    user = User(
        username=username,
        hashed_password=hash_password(password),
        role="admin",
        allowed_containers=None,
    )
    session.add(user)
    await session.commit()
