from fastapi import Depends, FastAPI
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from admin.admin_app import init_admin
from routers import all_routers
from routers.utils import verify_api_key

app = FastAPI(root_path='/api/core')
app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="*")

for router in all_routers:
    app.include_router(router)

@app.get('/health', dependencies=[Depends(verify_api_key)])
async def health():
    return {"status": "ok"}

init_admin(app)
