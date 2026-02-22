from fastapi import APIRouter, Depends, UploadFile, File, Form, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from database import get_db, ChatMessage
from services.agent import process_message, save_message
from services.transcribe import transcribe_audio
import json

router = APIRouter(prefix="/ai", tags=["ai"])


def msg_to_dict(m: ChatMessage) -> dict:
    return {
        "id": m.id,
        "role": m.role,
        "content": m.content,
        "message_type": m.message_type,
        # Сохраняем meta как metadata — единый ключ для фронта
        "metadata": m.meta or {},
        "created_at": m.created_at.isoformat(),
    }


@router.get("/history")
def get_history(db: Session = Depends(get_db)):
    msgs = (
        db.query(ChatMessage)
        .filter(ChatMessage.user_id == 1)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )
    return [msg_to_dict(m) for m in msgs]


@router.post("/chat")
async def chat(message: str = Form(...), db: Session = Depends(get_db)):
    """
    Правильный порядок:
    1. Сохраняем сообщение пользователя в БД
    2. Агент читает историю из БД (включая только что сохранённое)
       — process_message НЕ добавляет сообщение ещё раз
    3. Сохраняем ответ ИИ в БД
    4. Возвращаем результат
    """
    save_message(db, "user", message, user_id=1, msg_type="text")
    result = await process_message(db, user_id=1)
    ai_text = result.get("message") or "Готово."
    save_message(db, "assistant", ai_text, user_id=1, msg_type="text", meta=result)
    return result


@router.post("/voice")
async def voice_chat(audio: UploadFile = File(...), db: Session = Depends(get_db)):
    audio_bytes = await audio.read()
    transcript = await transcribe_audio(audio_bytes, audio.filename or "audio.webm")
    save_message(db, "user", transcript, user_id=1, msg_type="voice")
    result = await process_message(db, user_id=1)
    ai_text = result.get("message") or "Готово."
    save_message(db, "assistant", ai_text, user_id=1, msg_type="text", meta=result)
    result["transcript"] = transcript
    return result


@router.post("/upload-file")
async def upload_file(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = await file.read()
    try:
        text = content.decode("utf-8")
    except Exception:
        text = content.decode("latin-1", errors="replace")
    prompt = f"Я загрузил файл '{file.filename}'. Извлеки все задачи:\n\n{text[:4000]}"
    save_message(db, "user", prompt, user_id=1, msg_type="file")
    result = await process_message(db, user_id=1)
    ai_text = result.get("message") or "Готово."
    save_message(db, "assistant", ai_text, user_id=1, msg_type="text", meta=result)
    result["filename"] = file.filename
    return result


@router.delete("/history")
def clear_history(db: Session = Depends(get_db)):
    db.query(ChatMessage).filter(ChatMessage.user_id == 1).delete()
    db.commit()
    return {"ok": True}


@router.websocket("/ws")
async def websocket_chat(websocket: WebSocket, db: Session = Depends(get_db)):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            try:
                payload = json.loads(data)
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({"error": "Invalid JSON"}))
                continue
            
            message = payload.get("message", "")
            if not message: continue

            # Рекомендуется обернуть в транзакцию
            save_message(db, "user", message, user_id=1)
            result = await process_message(db, user_id=1)
            ai_text = result.get("message") or "Готово."
            save_message(db, "assistant", ai_text, user_id=1, meta=result)
            
            await websocket.send_text(json.dumps(result))
    except WebSocketDisconnect:
        pass