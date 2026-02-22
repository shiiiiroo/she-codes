"""
Voice transcription via faster-whisper (no API key, no system ffmpeg needed).
Accepts audio file (webm/mp4/wav/ogg) and returns text.

Install: pip install faster-whisper
"""
import os
import tempfile
import asyncio
import functools

_whisper_model = None

def _get_model():
    global _whisper_model
    if _whisper_model is None:
        from faster_whisper import WhisperModel
        # cpu + int8 — работает без GPU, без системного ffmpeg
        _whisper_model = WhisperModel("base", device="cpu", compute_type="int8")
    return _whisper_model


def _transcribe_sync(tmp_path: str) -> str:
    model = _get_model()
    segments, _ = model.transcribe(tmp_path, language=None)
    return " ".join(s.text for s in segments).strip()


async def transcribe_audio(audio_bytes: bytes, filename: str = "audio.webm") -> str:
    suffix = os.path.splitext(filename)[-1] or ".webm"

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        loop = asyncio.get_event_loop()
        text = await loop.run_in_executor(
            None,
            functools.partial(_transcribe_sync, tmp_path)
        )
        return text
    finally:
        os.unlink(tmp_path)


async def transcribe_from_path(file_path: str) -> str:
    with open(file_path, "rb") as f:
        audio_bytes = f.read()
    return await transcribe_audio(audio_bytes, os.path.basename(file_path))