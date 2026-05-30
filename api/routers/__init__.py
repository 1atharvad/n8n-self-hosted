from .files import router as files_router
from .image import router as image_router
from .tts import router as tts_router
from .video import router as video_router
from .voice import router as voice_router
from .cpu_gate import router as cpu_gate_router

all_routers = [tts_router, image_router, video_router, files_router, voice_router, cpu_gate_router]
