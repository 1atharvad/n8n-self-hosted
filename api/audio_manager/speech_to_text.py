import asyncio
import collections
import io
import tempfile
import wave
from pathlib import Path
from typing import Optional

import webrtcvad
from faster_whisper import WhisperModel

DEFAULT_MODEL = "base"
DEFAULT_LANGUAGE = "en"

# Flutter must send: 16kHz, 16-bit, mono PCM
SAMPLE_RATE = 16000
CHANNELS = 1
SAMPLE_WIDTH = 2  # bytes per sample (16-bit)

# VAD frame size — webrtcvad only accepts 10 / 20 / 30 ms frames
FRAME_DURATION_MS = 30
FRAME_BYTES = int(SAMPLE_RATE * FRAME_DURATION_MS / 1000) * SAMPLE_WIDTH  # 960 bytes

# How many consecutive silent frames signal end of utterance (30ms × 20 = 600ms)
NUM_PADDING_FRAMES = 20
SPEECH_RATIO = 0.75  # fraction of voiced frames needed to trigger speech start


class VADStream:
    """
    Stateful, per-connection voice activity detector.

    Feed raw 16 kHz 16-bit mono PCM chunks via process().
    Returns the complete utterance as PCM bytes the moment
    silence is detected after speech — otherwise returns None.

    One instance per WebSocket connection.
    """

    def __init__(self, aggressiveness: int = 2):
        # aggressiveness 0–3: higher filters out more non-speech
        self._vad = webrtcvad.Vad(aggressiveness)
        self._buf = b""
        self._ring: collections.deque = collections.deque(maxlen=NUM_PADDING_FRAMES)
        self._voiced: list[bytes] = []
        self._triggered = False

    def process(self, chunk: bytes) -> Optional[bytes]:
        """
        Feed a PCM chunk of any size.
        Returns complete utterance PCM when end-of-speech is detected, else None.
        """
        self._buf += chunk

        while len(self._buf) >= FRAME_BYTES:
            frame, self._buf = self._buf[:FRAME_BYTES], self._buf[FRAME_BYTES:]
            is_speech = self._vad.is_speech(frame, SAMPLE_RATE)

            if not self._triggered:
                self._ring.append((frame, is_speech))
                voiced = sum(1 for _, s in self._ring if s)
                if len(self._ring) > 0 and voiced / len(self._ring) >= SPEECH_RATIO:
                    self._triggered = True
                    self._voiced = [f for f, _ in self._ring]
                    self._ring.clear()
            else:
                self._voiced.append(frame)
                self._ring.append((frame, is_speech))
                unvoiced = sum(1 for _, s in self._ring if not s)
                if (
                    len(self._ring) == self._ring.maxlen
                    and unvoiced / len(self._ring) >= SPEECH_RATIO
                ):
                    utterance = b"".join(self._voiced)
                    self._reset()
                    return utterance

        return None

    def _reset(self):
        self._buf = b""
        self._ring.clear()
        self._voiced = []
        self._triggered = False


class SpeechToText:
    """
    Singleton Whisper STT using faster-whisper.

    Model sizes (speed vs accuracy):
        tiny, base, small, medium, large-v2, large-v3
    """

    _instance = None

    def __new__(cls, model_size: str = DEFAULT_MODEL):
        if not cls._instance:
            cls._instance = super().__new__(cls)
            cls._instance._model = WhisperModel(
                model_size, device="cpu", compute_type="int8"
            )
            print(f"Whisper model loaded: {model_size}")
        return cls._instance

    @staticmethod
    def _pcm_to_wav(pcm: bytes) -> bytes:
        """Wrap raw PCM bytes in a WAV container."""
        buf = io.BytesIO()
        with wave.open(buf, 'wb') as wf:
            wf.setnchannels(CHANNELS)
            wf.setsampwidth(SAMPLE_WIDTH)
            wf.setframerate(SAMPLE_RATE)
            wf.writeframes(pcm)
        return buf.getvalue()

    def transcribe(self, audio_bytes: bytes, language: str = DEFAULT_LANGUAGE) -> str:
        """Transcribe WAV / any ffmpeg-supported audio bytes to text."""
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name
        try:
            segments, _ = self._model.transcribe(
                tmp_path,
                language=language,
                beam_size=5,
                vad_filter=True,
                vad_parameters={"min_silence_duration_ms": 300},
            )
            return " ".join(seg.text.strip() for seg in segments).strip()
        finally:
            Path(tmp_path).unlink(missing_ok=True)

    def transcribe_pcm(self, pcm: bytes, language: str = DEFAULT_LANGUAGE) -> str:
        """Transcribe raw 16 kHz 16-bit mono PCM bytes to text."""
        return self.transcribe(self._pcm_to_wav(pcm), language)

    async def transcribe_pcm_async(
        self, pcm: bytes, language: str = DEFAULT_LANGUAGE
    ) -> str:
        """Non-blocking wrapper — runs in the default thread pool."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self.transcribe_pcm, pcm, language)


if __name__ == "__main__":
    try:
        import sounddevice as sd
    except ImportError:
        print("Run: pip install sounddevice")
        raise SystemExit(1)

    print(f"Loading Whisper model ({DEFAULT_MODEL})...")
    stt = SpeechToText()
    vad = VADStream()

    utterance: Optional[bytes] = None

    def _callback(indata, frames, time, status):
        global utterance
        if utterance is None:
            result = vad.process(bytes(indata))
            if result is not None:
                utterance = result

    print("Speak now — transcription starts automatically after you stop speaking...")
    with sd.RawInputStream(
        samplerate=SAMPLE_RATE,
        channels=CHANNELS,
        dtype="int16",
        blocksize=FRAME_BYTES // SAMPLE_WIDTH,
        callback=_callback,
    ):
        while utterance is None:
            sd.sleep(100)

    print("Transcribing...")
    print(f"\n{stt.transcribe_pcm(utterance)}")
