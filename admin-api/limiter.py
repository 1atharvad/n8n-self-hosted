import os
from slowapi import Limiter
from slowapi.util import get_remote_address

_redis_host = os.getenv("REDIS_HOST", "redis")
_redis_port = os.getenv("REDIS_PORT", "6379")

limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=f"redis://{_redis_host}:{_redis_port}",
)
