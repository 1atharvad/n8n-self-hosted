import os

from fastapi import Depends, FastAPI
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from admin.admin_app import init_admin
from routers import all_routers
from routers.utils import verify_api_key

assert os.getenv("ADMIN_SECRET_KEY"), "ADMIN_SECRET_KEY env var must be set"

app = FastAPI(root_path='/api/core')

app.mount(
    "/admin-assets",
    StaticFiles(
        directory=os.path.join(os.path.dirname(__file__), "admin", "static")
    ),
    name="admin-assets",
)
app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="*")
app.add_middleware(
    SessionMiddleware,
    secret_key=os.getenv("ADMIN_SECRET_KEY", "change-me-in-production"),
)

for router in all_routers:
    app.include_router(router, dependencies=[Depends(verify_api_key)])


@app.get('/health', dependencies=[Depends(verify_api_key)])
async def health():
    return {"status": "ok"}


init_admin(app)
