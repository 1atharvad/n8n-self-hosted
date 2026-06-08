import os

import httpx
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from audio_manager import SpeechToText
from audio_manager import TextToVoice as AudioTTS
from audio_manager.speech_to_text import VADStream

router = APIRouter(tags=["Voice Chat"])

stt = SpeechToText()
audio_tts = AudioTTS()

N8N_BASE_URL = os.getenv("N8N_WEBHOOK_BASE_URL", "http://n8n:5678/webhook")
DEFAULT_WEBHOOK_ID = "voice-chat"


@router.websocket("/ws/voice-chat")
async def voice_chat(
    websocket: WebSocket,
    webhook_id: str = DEFAULT_WEBHOOK_ID,
):
    """
    Live AI voice chat over WebSocket.

    Binary protocol (per frame):
        Client → server : raw 16 kHz 16-bit mono PCM chunks (~100 ms each)
        Server → client : WAV audio chunks, one per TTS sentence

    Flow per utterance:
        PCM chunks → VAD detects end-of-speech → Whisper STT
        → n8n LLM webhook → Kokoro TTS streamed sentence by sentence → client

    Args:
        websocket (WebSocket): The active WebSocket connection.
        webhook_id (str): n8n webhook ID to route the utterance through.
            Defaults to 'voice-chat'.
    """
    await websocket.accept()
    vad = VADStream()
    webhook_url = f"{N8N_BASE_URL}/{webhook_id}"

    try:
        while True:
            pcm_chunk = await websocket.receive_bytes()

            utterance_pcm = vad.process(pcm_chunk)
            if utterance_pcm is None:
                continue

            user_text = await stt.transcribe_pcm_async(utterance_pcm)
            if not user_text:
                continue

            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    webhook_url,
                    json={"text": user_text},
                    timeout=30,
                )
            ai_response = resp.json().get("response", "")
            if not ai_response:
                continue

            for wav_chunk in audio_tts.synthesize_stream(ai_response):
                await websocket.send_bytes(wav_chunk)

    except WebSocketDisconnect:
        pass
