import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from auth.security import (
    create_access_token,
    get_current_user,
    require_admin,
    verify_password,
)
from db.crud import (
    create_audit_log,
    create_user,
    delete_user,
    get_user_by_id,
    get_user_by_username,
    list_users,
    update_user,
)
from db.database import get_session
from db.models import User
from limiter import limiter

router = APIRouter(tags=["Auth"])

# ── Request / Response schemas ────────────────────────────────────────────────


class LoginRequest(BaseModel):
    username: str
    password: str


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str = Field(min_length=8)


class CreateUserRequest(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=8)
    role: str = Field(default="viewer", pattern="^(admin|viewer)$")
    allowed_containers: Optional[list[str]] = None


class UpdateUserRequest(BaseModel):
    role: Optional[str] = Field(default=None, pattern="^(admin|viewer)$")
    allowed_containers: Optional[list[str]] = None
    clear_container_restriction: bool = False
    is_active: Optional[bool] = None
    password: Optional[str] = Field(default=None, min_length=8)


def user_dict(user: User) -> dict:
    return {
        "id": str(user.id),
        "username": user.username,
        "role": user.role,
        "allowed_containers": user.allowed_containers,
        "is_active": user.is_active,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


# ── Public endpoints ──────────────────────────────────────────────────────────


@router.post("/login")
@limiter.limit("10/minute")
async def login(
    request: Request,
    body: LoginRequest,
    session: AsyncSession = Depends(get_session),
):
    ip = request.client.host if request.client else None
    user = await get_user_by_username(session, body.username)
    if not user or not user.is_active or not verify_password(body.password, user.hashed_password):
        await create_audit_log(session, action="login_failed", target_name=body.username, ip_address=ip)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )
    token = create_access_token(user)
    await create_audit_log(session, action="login", actor_id=str(user.id), actor_name=user.username, ip_address=ip)
    return {
        "access_token": token,
        "token_type": "bearer",
        **user_dict(user),
    }


# ── Self-service (any authenticated user) ────────────────────────────────────


@router.get("/me")
async def me(current_user: User = Depends(get_current_user)):
    return user_dict(current_user)


@router.post("/change-password")
async def change_password(
    request: Request,
    body: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if not verify_password(body.old_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect current password",
        )
    ip = request.client.host if request.client else None
    await update_user(session, current_user, password=body.new_password)
    await create_audit_log(session, action="password_changed", actor_id=str(current_user.id), actor_name=current_user.username, ip_address=ip)
    return {"ok": True}


# ── Admin-only user management ────────────────────────────────────────────────


@router.get("/users")
async def get_users(
    _admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    users = await list_users(session)
    return {"users": [user_dict(u) for u in users]}


@router.post("/users", status_code=status.HTTP_201_CREATED)
async def create_new_user(
    request: Request,
    body: CreateUserRequest,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    existing = await get_user_by_username(session, body.username)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already exists",
        )
    user = await create_user(
        session,
        username=body.username,
        password=body.password,
        role=body.role,
        allowed_containers=body.allowed_containers,
    )
    ip = request.client.host if request.client else None
    await create_audit_log(session, action="user_created", actor_id=str(admin.id), actor_name=admin.username, target_name=body.username, detail=body.role, ip_address=ip)
    return user_dict(user)


@router.patch("/users/{user_id}")
async def update_existing_user(
    request: Request,
    user_id: uuid.UUID,
    body: UpdateUserRequest,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    user = await get_user_by_id(session, str(user_id))
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if body.is_active is False and user.id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot deactivate your own account",
        )

    # `clear_container_restriction=True` sets allowed_containers to NULL (all)
    new_containers: Optional[list[str]] | str = "UNCHANGED"
    if body.clear_container_restriction:
        new_containers = None
    elif body.allowed_containers is not None:
        new_containers = body.allowed_containers

    changes: list[str] = []
    if body.role is not None and body.role != user.role:
        changes.append(f"role→{body.role}")
    if body.is_active is not None and body.is_active != user.is_active:
        changes.append(f"active→{body.is_active}")
    if body.password:
        changes.append("password_reset")
    if body.clear_container_restriction:
        changes.append("containers→all")
    elif body.allowed_containers is not None:
        changes.append(f"containers→{','.join(body.allowed_containers) or 'none'}")

    user = await update_user(
        session,
        user,
        role=body.role,
        allowed_containers=new_containers,
        is_active=body.is_active,
        password=body.password,
    )
    ip = request.client.host if request.client else None
    if changes:
        await create_audit_log(
            session,
            action="user_updated",
            actor_id=str(admin.id),
            actor_name=admin.username,
            target_name=user.username,
            detail="; ".join(changes),
            ip_address=ip,
        )
    return user_dict(user)


@router.delete("/users/{user_id}")
async def delete_existing_user(
    request: Request,
    user_id: uuid.UUID,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    if str(user_id) == admin.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot delete your own account",
        )
    user = await get_user_by_id(session, str(user_id))
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    ip = request.client.host if request.client else None
    deleted_name = user.username
    await delete_user(session, user)
    await create_audit_log(session, action="user_deleted", actor_id=str(admin.id), actor_name=admin.username, target_name=deleted_name, ip_address=ip)
    return {"ok": True}
