from fastapi import APIRouter, Depends

from auth.security import get_current_user
from n8n.folders import router as folders_router
from n8n.stats import router as stats_router
from n8n.workflows import router as workflows_router

router = APIRouter(dependencies=[Depends(get_current_user)])
router.include_router(stats_router)
router.include_router(folders_router)
router.include_router(workflows_router)
