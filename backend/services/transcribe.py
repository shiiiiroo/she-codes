"""
Voice transcription via OpenAI Whisper API.
Accepts audio file (webm/mp4/wav/ogg) and returns text.
"""
import os
import tempfile
from openai import AsyncOpenAI

openai_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY", ""))


async def transcribe_audio(audio_bytes: bytes, filename: str = "audio.webm") -> str:
    """
    Transcribe audio bytes using OpenAI Whisper.
    Returns transcribed text string.
    """
    suffix = os.path.splitext(filename)[-1] or ".webm"

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        with open(tmp_path, "rb") as f:
            transcript = await openai_client.audio.transcriptions.create(
                model="whisper-1",
                file=(filename, f, "audio/webm"),
                response_format="text",
            )
        return str(transcript).strip()
    finally:
        os.unlink(tmp_path)


async def transcribe_from_path(file_path: str) -> str:
    with open(file_path, "rb") as f:
        audio_bytes = f.read()
    return await transcribe_audio(audio_bytes, os.path.basename(file_path))
