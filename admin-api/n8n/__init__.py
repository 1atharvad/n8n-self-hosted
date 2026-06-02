from fastapi import APIRouter

from n8n.router import router as _routes

router = APIRouter(prefix="/n8n", tags=["N8N"])
router.include_router(_routes)
