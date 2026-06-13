import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, JSON, String
from sqlalchemy.orm import declarative_base

Base = declarative_base()


def _new_uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=_new_uuid)
    username = Column(String(64), nullable=False, unique=True, index=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(16), nullable=False, default="viewer")
    allowed_containers = Column(JSON, nullable=True, default=None)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_now, onupdate=_now)


class EnvVar(Base):
    __tablename__ = "env_vars"

    key = Column(String(256), primary_key=True)
    value = Column(String(4096), nullable=False)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_now, onupdate=_now)


class AppConfig(Base):
    __tablename__ = "app_config"

    key = Column(String(128), primary_key=True)
    value = Column(String(4096), nullable=False)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_now, onupdate=_now)


class AuditLog(Base):
    __tablename__ = "audit_log"

    id = Column(String(36), primary_key=True, default=_new_uuid)
    actor_id = Column(String(36), nullable=True)
    actor_name = Column(String(64), nullable=True)
    action = Column(String(64), nullable=False, index=True)
    target_name = Column(String(64), nullable=True)
    detail = Column(String(255), nullable=True)
    ip_address = Column(String(45), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_now, index=True)
