import os
from datetime import datetime, timezone
from typing import Optional

from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.security import hash_password
from db.models import AppConfig, AuditLog, EnvVar, User


async def get_user_by_username(session: AsyncSession, username: str) -> Optional[User]:
    result = await session.execute(select(User).where(User.username == username))
    return result.scalar_one_or_none()


async def get_user_by_id(session: AsyncSession, user_id: str) -> Optional[User]:
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


async def get_app_config(session: AsyncSession, key: str) -> Optional[str]:
    row = await session.get(AppConfig, key)
    return row.value if row else None


async def set_app_config(session: AsyncSession, key: str, value: str) -> None:
    existing = await session.get(AppConfig, key)
    if existing:
        existing.value = value
        existing.updated_at = datetime.now(timezone.utc)
    else:
        session.add(AppConfig(key=key, value=value))
    await session.commit()


async def delete_app_config(session: AsyncSession, key: str) -> None:
    existing = await session.get(AppConfig, key)
    if existing:
        await session.delete(existing)
        await session.commit()


async def get_env_var(session: AsyncSession, key: str) -> Optional[EnvVar]:
    return await session.get(EnvVar, key)


async def list_env_vars(session: AsyncSession) -> list[EnvVar]:
    result = await session.execute(select(EnvVar).order_by(EnvVar.key))
    return list(result.scalars().all())


async def set_env_var(session: AsyncSession, key: str, value: str) -> EnvVar:
    existing = await session.get(EnvVar, key)
    if existing:
        existing.value = value
        existing.updated_at = datetime.now(timezone.utc)
        await session.commit()
        await session.refresh(existing)
        return existing
    var = EnvVar(key=key, value=value)
    session.add(var)
    await session.commit()
    await session.refresh(var)
    return var


async def delete_env_var(session: AsyncSession, key: str) -> bool:
    existing = await session.get(EnvVar, key)
    if not existing:
        return False
    await session.delete(existing)
    await session.commit()
    return True


async def create_audit_log(
    session: AsyncSession,
    action: str,
    actor_id: Optional[str] = None,
    actor_name: Optional[str] = None,
    target_name: Optional[str] = None,
    detail: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> AuditLog:
    entry = AuditLog(
        actor_id=actor_id,
        actor_name=actor_name,
        action=action,
        target_name=target_name,
        detail=detail,
        ip_address=ip_address,
    )
    session.add(entry)
    await session.commit()
    return entry


async def list_audit_logs(session: AsyncSession, limit: int = 100) -> tuple[list[AuditLog], int, int]:
    rows = await session.execute(
        select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)
    )
    total = await session.execute(select(func.count()).select_from(AuditLog))
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    events_24h = await session.execute(
        select(func.count()).select_from(AuditLog).where(AuditLog.created_at >= since)
    )
    return list(rows.scalars().all()), total.scalar_one(), events_24h.scalar_one()


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
