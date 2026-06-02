from fastapi import APIRouter

from env.router import router as _routes

router = APIRouter(prefix="/env", tags=["Env"])
router.include_router(_routes)
