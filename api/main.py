from fastapi import FastAPI
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from admin.admin_app import init_admin
from routers import all_routers

app = FastAPI(root_path='/api/core')
app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="*")

for router in all_routers:
    app.include_router(router)

init_admin(app)
