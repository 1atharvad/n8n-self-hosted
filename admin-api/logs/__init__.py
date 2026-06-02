from fastapi import APIRouter

from logs.router import logs_router
from logs.audit import router as _audit
from logs.internal import router as _internal

router = APIRouter(tags=["Logs"])
router.include_router(logs_router)

audit_router = APIRouter(tags=["Audit"])
audit_router.include_router(_audit)
audit_router.include_router(_internal)
