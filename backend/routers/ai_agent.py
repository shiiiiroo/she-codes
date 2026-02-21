from fastapi import APIRouter, Depends, UploadFile, File, Form, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from database import get_db, ChatMessage
from services.agent import process_message
from services.transcribe import transcribe_audio
import json

router = APIRouter(prefix="/ai", tags=["ai"])


def msg_to_dict(m: ChatMessage) -> dict:
    return {
        "id": m.id,
        "role": m.role,
        "content": m.content,
        "message_type": m.message_type,
        "metadata": m.meta or {},
        "created_at": m.created_at.isoformat(),
    }


@router.get("/history")
def get_history(limit: int = 50, db: Session = Depends(get_db)):
    msgs = (
        db.query(ChatMessage)
        .filter(ChatMessage.user_id == 1)
        .order_by(ChatMessage.created_at.asc())
        .limit(limit)
        .all()
    )
    return [msg_to_dict(m) for m in msgs]


@router.post("/chat")
async def chat(
    message: str = Form(...),
    db: Session = Depends(get_db),
):
    # 1. СОХРАНЯЕМ СООБЩЕНИЕ ПОЛЬЗОВАТЕЛЯ
    user_msg = ChatMessage(
        user_id=1,
        role="user",
        content=message,
        message_type="text",
        meta={}
    )
    print(f"DEBUG: Saving message from user: {message}")
    db.add(user_msg)
    db.commit()
    print("DEBUG: Commit successful!") # Сохраняем, чтобы получить ID или просто зафиксировать

    # 2. ПОЛУЧАЕМ ОТВЕТ ОТ АГЕНТА
    result = await process_message(message, db, user_id=1, msg_type="text")
    
    # 3. СОХРАНЯЕМ ОТВЕТ АССИСТЕНТА
    # Берем текст ответа из поля 'message' (которое возвращает ваш агент)
    ai_content = result.get("message") or "Задача обновлена"
    
    ai_msg = ChatMessage(
        user_id=1,
        role="assistant",
        content=ai_content,
        message_type="text",
        meta=result # Сохраняем весь результат (tasks_created и т.д.) в метаданные
    )
    db.add(ai_msg)
    db.commit()

    return result

@router.post("/voice")
async def voice_chat(
    audio: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    audio_bytes = await audio.read()
    transcript = await transcribe_audio(audio_bytes, audio.filename or "audio.webm")
    result = await process_message(transcript, db, user_id=1, msg_type="voice")
    result["transcript"] = transcript
    return result


@router.post("/upload-file")
async def upload_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Accept text/pdf/docx file with task descriptions and process through agent."""
    content = await file.read()
    # For now: treat as plain text (can add PDF parsing later)
    try:
        text = content.decode("utf-8")
    except Exception:
        text = content.decode("latin-1", errors="replace")

    prompt = f"I uploaded a file '{file.filename}' with the following content. Please extract all tasks from it:\n\n{text[:4000]}"
    result = await process_message(prompt, db, user_id=1, msg_type="file")
    result["filename"] = file.filename
    return result


@router.websocket("/ws")
async def websocket_chat(websocket: WebSocket, db: Session = Depends(get_db)):
    """WebSocket for real-time chat."""
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            payload = json.loads(data)
            message = payload.get("message", "")
            msg_type = payload.get("type", "text")

            result = await process_message(message, db, user_id=1, msg_type=msg_type)
            await websocket.send_text(json.dumps(result))
    except WebSocketDisconnect:
        pass
