from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

ASSET_FILES_DIR = Path(BASE_DIR, 'n8n_files')
AUDIO_FILES_DIR = Path(ASSET_FILES_DIR, 'audio_files')
VIDEO_FILES_DIR = Path(ASSET_FILES_DIR, 'video_files')
PPT_FILES_DIR = Path(ASSET_FILES_DIR, 'ppt_files')
PDF_FILES_DIR = Path(ASSET_FILES_DIR, 'pdf_files')
SLIDE_IMG_FILES_DIR = Path(ASSET_FILES_DIR, 'ppt_images')

TTS_CACHE_DIR = Path(BASE_DIR, 'tts_cache')
TTS_MODEL_PATH = Path(TTS_CACHE_DIR, 'kokoro-v1.0.onnx')
TTS_VOICES_PATH = Path(TTS_CACHE_DIR, 'voices-v1.0.bin')
