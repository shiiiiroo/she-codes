from faster_whisper import WhisperModel
import os

# Загружаем модель (base — оптимально по скорости и качеству)
stt_model = WhisperModel("base", device="cpu", compute_type="int8")

async def transcribe_audio(audio_bytes: bytes, filename: str):
    # Сохраняем временный файл, чтобы whisper его прочитал
    temp_path = f"temp_{filename}"
    with open(temp_path, "wb") as f:
        f.write(audio_bytes)
    
    # Транскрибируем
    segments, _ = stt_model.transcribe(temp_path, beam_size=5)
    text = "".join([segment.text for segment in segments])
    
    # Удаляем временный файл
    os.remove(temp_path)
    return text.strip()