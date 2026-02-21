import json
import re
import os
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from database import Task, UserProfile, AIMemory, ChatMessage
from openai import AsyncOpenAI  # Используем этот клиент для Ollama

# Настройка локального клиента Ollama
# Базовый адрес стандартный, ключ можно написать любой
client = AsyncOpenAI(
    base_url="http://localhost:11434/v1",
    api_key="ollama" 
)

AGENT_SYSTEM = """You are TaskFlow AI — an intelligent assistant.
Current Date: {today}

USER CONTEXT:
{user_context}

USER MEMORY:
{user_memory}

CURRENT TASKS (for reference/editing):
{tasks_today}

Your goal is to manage tasks and return ONLY STRICT JSON.
RESPONSE FORMAT:
{
  "message": "Friendly response to user",
  "tasks_to_create": [
    {
      "title": "Task name",
      "category": "work|study|health|personal|finance|social|unsorted",
      "priority": "critical|high|medium|low",
      "duration_minutes": 30,
      "start_datetime": "ISO string or null"
    }
  ],
  "tasks_to_update": [
    {
      "id": 123, 
      "updates": {
        "title": "New title",
        "priority": "critical|high|medium|low",
        "start_datetime": "ISO string"
      }
    }
  ],
  "tasks_to_unsorted": [],
  "clarifying_questions": [],
  "memories_to_save": [],
  "tips": []
}

Rules:
- Today's date: {today}. Use this to resolve relative dates like "tomorrow" or "next Monday".
- ALWAYS respond in the same language as the user (Russian/English).
- Return ONLY JSON.
- To edit a task, identify its ID from CURRENT TASKS.
- If the user doesn't specify a time, set start_datetime to null or ask a clarifying question.
"""
def get_user_context(db: Session, user_id: int = 1) -> dict:
    user = db.query(UserProfile).filter(UserProfile.id == user_id).first()
    if not user: return {}
    return {
        "name": user.name, "occupation": user.occupation,
        "max_daily_hours": user.max_daily_hours
    }

def get_user_memory(db: Session, user_id: int = 1) -> str:
    memories = db.query(AIMemory).filter(AIMemory.user_id == user_id).all()
    if not memories: return "No memory yet."
    return json.dumps({m.key: m.value for m in memories}, ensure_ascii=False)

def get_tasks_today(db: Session, user_id: int = 1) -> list:
    today = datetime.now().date()
    # Берем задачи на сегодня или те, что уже просрочены (чтобы тоже можно было править)
    tasks = db.query(Task).filter(
        Task.user_id == user_id, 
        Task.status != "completed"
    ).all()
    
    return [
        {
            "id": t.id, 
            "title": t.title, 
            "priority": t.priority, 
            "start": t.start_datetime.isoformat() if t.start_datetime else None
        } 
        for t in tasks
    ]

def build_system_prompt(db: Session, user_id: int = 1) -> str:
    # 1. Берем реальное местное время, а не UTC, чтобы не было путаницы с "завтра"
    today = datetime.now().strftime("%A, %Y-%m-%d %H:%M")
    
    # 2. Собираем данные, которые ты уже умеешь доставать из БД
    user_ctx = get_user_context(db, user_id)
    user_mem = get_user_memory(db, user_id)
    tasks_today = get_tasks_today(db, user_id)

    prompt = AGENT_SYSTEM
    prompt = prompt.replace("{today}", today)
    # Теперь ИИ будет знать твое имя, работу и сколько часов в день ты работаешь
    prompt = prompt.replace("{user_context}", json.dumps(user_ctx, ensure_ascii=False))
    prompt = prompt.replace("{tasks_today}", json.dumps(tasks_today, ensure_ascii=False))
    prompt = prompt.replace("{user_memory}", user_mem)
    return prompt

def get_chat_history(db: Session, user_id: int = 1, limit: int = 10) -> list:
    msgs = db.query(ChatMessage).filter(ChatMessage.user_id == user_id).order_by(ChatMessage.created_at.desc()).limit(limit).all()
    msgs.reverse()
    return [{"role": m.role, "content": m.content} for m in msgs]

def save_message(db: Session, role: str, content: str, user_id: int = 1, msg_type: str = "text", metadata: dict = None):
    msg = ChatMessage(user_id=user_id, role=role, content=content, message_type=msg_type, meta=metadata or {})
    db.add(msg)
    db.commit()

def create_tasks_from_ai(db: Session, tasks_data: list, user_id: int = 1) -> list:
    created = []
    for td in tasks_data:
        task = Task(
            user_id=user_id,
            title=td.get("title", "Новая задача"),
            category=td.get("category", "unsorted"),
            priority=td.get("priority", "medium"),
            duration_minutes=td.get("duration_minutes", 30),
            ai_generated=True
        )
        if td.get("start_datetime"):
            try:
                task.start_datetime = datetime.fromisoformat(td["start_datetime"])
            except: pass
        db.add(task)
        created.append(task)
    db.commit()
    for t in created: db.refresh(t)
    return created

def parse_agent_response(text: str) -> dict:
    """Парсит JSON, даже если ИИ добавил лишний текст."""
    try:
        return json.loads(text)
    except:
        match = re.search(r'\{.*\}', text, re.DOTALL)
        if match:
            try: return json.loads(match.group())
            except: pass
    return {"message": text, "tasks_to_create": []}
def update_task_in_db(db: Session, task_id: int, updates: dict):
    print(f"DEBUG: Attempting to update task {task_id} with {updates}") # Увидишь это в терминале
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        print(f"DEBUG: Task {task_id} not found")
        return None
    
    for field, value in updates.items():
        if hasattr(task, field):
            if field in ["start_datetime", "deadline", "end_datetime"] and isinstance(value, str):
                try:
                    # Убираем лишние символы, если ИИ их добавил
                    clean_date = value.replace('Z', '').split('+')[0]
                    value = datetime.fromisoformat(clean_date)
                except Exception as e:
                    print(f"DEBUG: Date error: {e}")
                    continue
            setattr(task, field, value)
            
    db.commit()
    db.refresh(task)
    print(f"DEBUG: Task {task_id} updated successfully")
    return task

async def process_message(user_message: str, db: Session, user_id: int = 1, msg_type: str = "text") -> dict:
    system_prompt = build_system_prompt(db, user_id)
    history = get_chat_history(db, user_id)

    save_message(db, "user", user_message, user_id, msg_type)

    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(history)
    messages.append({"role": "user", "content": user_message})

    try:
        response = await client.chat.completions.create(
            model="qwen2.5-coder:7b",
            messages=messages,
            temperature=0.1 
        )
        raw_content = response.choices[0].message.content
    except Exception as e:
        return {"message": f"Ошибка Ollama: {str(e)}", "tasks_created": []}

    parsed = parse_agent_response(raw_content)
    save_message(db, "assistant", parsed.get("message", raw_content), user_id, metadata=parsed)
    
    # --- СОЗДАНИЕ ЗАДАЧ ---
    all_task_data = parsed.get("tasks_to_create", []) + parsed.get("tasks_to_unsorted", [])
    created_tasks = create_tasks_from_ai(db, all_task_data, user_id)

    # --- ОБНОВЛЕНИЕ ЗАДАЧ (Твой новый блок) ---
    updated_task_ids = []
    if parsed.get("tasks_to_update"):
        for item in parsed["tasks_to_update"]:
            t_id = item.get("id")
            updates = item.get("updates")
            if t_id and updates:
                success = update_task_in_db(db, t_id, updates)
                if success:
                    updated_task_ids.append(t_id)

    return {
        "message": parsed.get("message", ""),
        "tasks_created": [{"id": t.id, "title": t.title} for t in created_tasks],
        "tasks_updated": updated_task_ids, # Сообщаем фронтенду, какие ID изменились
        "clarifying_questions": parsed.get("clarifying_questions", []),
        "tips": parsed.get("tips", [])
    }