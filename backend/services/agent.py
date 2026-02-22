"""
AI Agent — TaskFlow. Supports Anthropic Claude + Ollama (Qwen, Llama, etc.)
"""
import json, re, os
import httpx
from datetime import datetime, timedelta
from dotenv import load_dotenv
load_dotenv()

from sqlalchemy.orm import Session
from database import Task, UserProfile, AIMemory, ChatMessage


# ─── MODEL BACKEND ────────────────────────────────────────────────────────────
OLLAMA_URL    = os.getenv("OLLAMA_URL", "")
OLLAMA_MODEL  = os.getenv("OLLAMA_MODEL", "qwen2.5-coder:7b")
ANTHROPIC_KEY = os.getenv("ANTHROPIC_API_KEY", "")
USE_OLLAMA    = bool(OLLAMA_URL)

_client = None
if USE_OLLAMA:
    print(f"[Agent] Ollama → {OLLAMA_URL}  model={OLLAMA_MODEL}")
else:
    from anthropic import Anthropic
    _client = Anthropic(api_key=ANTHROPIC_KEY) if ANTHROPIC_KEY else None
    print("[Agent] Anthropic Claude")


# ─── SYSTEM PROMPT ────────────────────────────────────────────────────────────
SYSTEM_STATIC = """You are TaskFlow AI, a personal task planner. You MUST respond ONLY with valid JSON. No explanations, no markdown, no plain text - ONLY JSON.

CRITICAL RULES:
1. ALWAYS respond with JSON object starting with { and ending with }
2. NEVER write plain text responses
3. NEVER use markdown formatting or ```json blocks
4. Put your answer to user in the "message" field
5. Respond in the same language as the user

TASK OPERATIONS:
- CREATE new task → add to tasks_to_create with start_datetime
- UPDATE/MOVE task → add to tasks_to_update with id + changed fields only
- DELETE one task → add id to tasks_to_delete
- DELETE ALL tasks → add ALL ids from ACTIVE TASKS list to tasks_to_delete

DATE RULES:
- Always set start_datetime when user mentions a day or time
- Format: "YYYY-MM-DDTHH:MM:00" (use today/tomorrow dates from context)
- Default time if not specified: "09:00"
- NEVER leave start_datetime null if user said "today", "tomorrow", or a specific time

REQUIRED JSON FORMAT (respond with exactly this structure):
{
  "message": "Response to user in their language",
  "tasks_to_create": [
    {
      "title": "Task title",
      "description": "Details",
      "category": "work|study|health|personal|finance|social|unsorted",
      "priority": "critical|high|medium|low",
      "duration_minutes": 60,
      "start_datetime": "2025-03-01T14:00:00",
      "deadline": null,
      "urgency_score": 0.5,
      "ai_notes": "",
      "subtasks": []
    }
  ],
  "tasks_to_update": [
    {
      "id": 42,
      "start_datetime": "2025-03-02T10:00:00",
      "deadline": null,
      "priority": "high",
      "title": "Новое название (только если меняется)",
      "status": "completed",
      "category": "work"
    }
  ],
  "tasks_to_delete": [1, 2, 3],
  "tasks_to_unsorted": [],
  "clarifying_questions": [],
  "memories_to_save": [{"key": "ключ", "value": "значение", "type": "preference|fact|pattern"}],
  "tips": [],
  "load_warning": null
}

REMEMBER: Your entire response must be valid JSON. Start with { and end with }. Nothing else.
"""


def build_system_prompt(db: Session, user_id: int = 1) -> str:
    user_ctx = get_user_context(db, user_id)
    user_mem = get_user_memory(db, user_id)
    active   = get_all_active_tasks(db, user_id)
    now      = datetime.now().strftime("%Y-%m-%d %H:%M")
    today    = datetime.now().strftime("%Y-%m-%d")
    tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")

    if active:
        task_lines = ""
        for t in active:
            dt = t.get("start_datetime") or t.get("deadline") or "без даты"
            task_lines += f'  ID={t["id"]} | "{t["title"]}" | {t["priority"]} | {t["category"]} | {dt}\n'
    else:
        task_lines = "  (нет активных задач)\n"

    all_ids = [t["id"] for t in active]
    delete_example = json.dumps(all_ids) if all_ids else "[1, 2, 3]"

    dynamic = (
        "\n\n═══ ТЕКУЩИЙ КОНТЕКСТ ═══\n"
        f"Сейчас: {now}\n"
        f"Сегодня: {today}\n"
        f"Завтра: {tomorrow}\n\n"
        "ПРОФИЛЬ: " + json.dumps(user_ctx, ensure_ascii=False) + "\n\n"
        "АКТИВНЫЕ ЗАДАЧИ (используй эти ID):\n" + task_lines +
        f"\nЕСЛИ ПОПРОСЯТ УДАЛИТЬ ВСЕ — используй tasks_to_delete: {delete_example}\n"
        "\nПАМЯТЬ: " + user_mem + "\n"
        "══════════════════════════\n"
    )
    return SYSTEM_STATIC + dynamic


def get_user_context(db: Session, user_id: int = 1) -> dict:
    u = db.query(UserProfile).filter(UserProfile.id == user_id).first()
    if not u:
        return {}
    return {
        "name": u.name,
        "occupation": u.occupation,
        "workplace": u.workplace,
        "max_daily_hours": u.max_daily_hours,
        "work_schedule": u.work_schedule,
        "health_notes": u.health_notes,
        "wake_time": u.wake_time,
        "sleep_time": u.sleep_time,
    }


def safe_parse_datetime(val):
    if not val or str(val).lower() in ("null", "none", ""):
        return None
    try:
        s = str(val).replace("Z", "+00:00").strip()
        return datetime.fromisoformat(s)
    except (ValueError, TypeError):
        return None


def get_user_memory(db: Session, user_id: int = 1) -> str:
    mems = db.query(AIMemory).filter(AIMemory.user_id == user_id).all()
    return json.dumps({m.key: m.value for m in mems}, ensure_ascii=False) if mems else "пусто"


def get_all_active_tasks(db: Session, user_id: int = 1) -> list:
    tasks = (
        db.query(Task)
        .filter(Task.user_id == user_id, Task.status != "completed")
        .order_by(Task.created_at.desc())
        .limit(20).all()
    )
    return [
        {
            "id": t.id,
            "title": t.title,
            "category": t.category,
            "priority": t.priority,
            "status": t.status,
            "start_datetime": t.start_datetime.strftime("%Y-%m-%d %H:%M") if t.start_datetime else None,
            "deadline": t.deadline.strftime("%Y-%m-%d %H:%M") if t.deadline else None,
        }
        for t in tasks
    ]


def get_chat_history(db: Session, user_id: int = 1, limit: int = 10) -> list:
    msgs = (
        db.query(ChatMessage)
        .filter(ChatMessage.user_id == user_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(limit).all()
    )
    msgs.reverse()
    history = [{"role": m.role, "content": m.content} for m in msgs]
    while history and history[0]["role"] != "user":
        history.pop(0)
    return history


def save_message(db: Session, role: str, content: str, user_id: int = 1,
                 msg_type: str = "text", meta: dict = None) -> ChatMessage:
    msg = ChatMessage(
        user_id=user_id, role=role, content=content,
        message_type=msg_type, meta=meta or {},
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg


def save_memories(db: Session, memories: list, user_id: int = 1):
    for mem in memories:
        key = mem.get("key", "")
        if not key:
            continue
        ex = db.query(AIMemory).filter(AIMemory.user_id == user_id, AIMemory.key == key).first()
        if ex:
            ex.value = mem.get("value", "")
            ex.updated_at = datetime.now()
        else:
            db.add(AIMemory(
                user_id=user_id, memory_type=mem.get("type", "fact"),
                key=key, value=mem.get("value", ""),
            ))
    db.commit()


def _detect_delete_all(user_message: str) -> bool:
    """Проверяет что пользователь хочет удалить ВСЕ задачи."""
    msg = user_message.lower()
    delete_words = ["удали", "удалить", "убери", "очисти", "стереть", "снеси"]
    all_words = ["все", "всё", "всех", "all", "everything"]
    has_delete = any(w in msg for w in delete_words)
    has_all = any(w in msg for w in all_words)
    return has_delete and has_all


def _detect_today_in_message(user_message: str) -> bool:
    """Проверяет что пользователь упомянул 'сегодня'."""
    msg = user_message.lower()
    return any(w in msg for w in ["сегодня", "today", "сёгодня"])


def _detect_tomorrow_in_message(user_message: str) -> bool:
    """Проверяет что пользователь упомянул 'завтра'."""
    msg = user_message.lower()
    return any(w in msg for w in ["завтра", "tomorrow"])


def compute_task_status(task) -> str:
    """
    Вычисляет статус задачи на основе времени:
    - Если задача выполнена — оставляем completed
    - Если start_datetime + duration_minutes < сейчас → overdue
    - Если deadline < сейчас → overdue
    - Иначе → pending / in_progress
    """
    if task.status == "completed":
        return "completed"

    now = datetime.now()

    # Проверка: начало + длительность уже прошли
    if task.start_datetime and task.duration_minutes:
        end_time = task.start_datetime + timedelta(minutes=task.duration_minutes)
        if end_time < now:
            return "overdue"

    # Проверка дедлайна
    if task.deadline and task.deadline < now:
        return "overdue"

    return task.status or "pending"


def refresh_overdue_tasks(db: Session, user_id: int = 1):
    """Обновляет статус просроченных задач в БД."""
    tasks = db.query(Task).filter(
        Task.user_id == user_id,
        Task.status.notin_(["completed", "overdue"])
    ).all()

    updated = False
    for task in tasks:
        new_status = compute_task_status(task)
        if new_status != task.status:
            task.status = new_status
            task.updated_at = datetime.now()
            updated = True

    if updated:
        db.commit()


def create_tasks_from_ai(db: Session, tasks_data: list, user_id: int = 1,
                          user_message: str = "") -> list:
    created = []
    today_date = datetime.now().strftime("%Y-%m-%d")
    tomorrow_date = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")

    for td in tasks_data:
        task = Task(
            user_id=user_id,
            title=td.get("title", "Новая задача"),
            description=td.get("description"),
            category=td.get("category", "unsorted"),
            priority=td.get("priority", "medium"),
            status="pending",
            duration_minutes=td.get("duration_minutes"),
            urgency_score=td.get("urgency_score", 0.5),
            ai_notes=td.get("ai_notes"),
            ai_generated=True,
            subtasks=[{"title": str(s), "done": False} for s in td.get("subtasks", []) if s],
        )

        start_dt = safe_parse_datetime(td.get("start_datetime"))
        deadline_dt = safe_parse_datetime(td.get("deadline"))

        # Если ИИ не поставил дату, но пользователь сказал "сегодня" — ставим сами
        if not start_dt and _detect_today_in_message(user_message):
            start_dt = datetime.strptime(f"{today_date}T09:00:00", "%Y-%m-%dT%H:%M:%S")
        elif not start_dt and _detect_tomorrow_in_message(user_message):
            start_dt = datetime.strptime(f"{tomorrow_date}T09:00:00", "%Y-%m-%dT%H:%M:%S")

        task.start_datetime = start_dt
        task.deadline = deadline_dt

        if task.start_datetime and task.duration_minutes:
            task.end_datetime = task.start_datetime + timedelta(minutes=task.duration_minutes)

        # Сразу проставляем правильный статус
        task.status = compute_task_status(task)

        db.add(task)
        created.append(task)

    if created:
        db.commit()
        for t in created:
            db.refresh(t)
    return created


def update_tasks_from_ai(db: Session, updates: list, user_id: int = 1) -> list:
    updated = []
    for upd in updates:
        task_id = upd.get("id")
        if not task_id:
            continue

        task = db.query(Task).filter(Task.id == task_id, Task.user_id == user_id).first()
        if not task:
            continue

        for field in ("title", "description", "category", "priority", "status", "duration_minutes"):
            if field in upd and upd[field] is not None:
                setattr(task, field, upd[field])

        for dt_field in ("start_datetime", "deadline"):
            if dt_field in upd:
                setattr(task, dt_field, safe_parse_datetime(upd[dt_field]))

        if "status" in upd:
            if upd["status"] == "completed" and not task.completed_at:
                task.completed_at = datetime.now()
            elif upd["status"] in ("pending", "in_progress"):
                task.completed_at = None

        task.updated_at = datetime.now()

        # Пересчитываем статус если не было явного status в запросе
        if "status" not in upd:
            new_status = compute_task_status(task)
            if new_status != task.status:
                task.status = new_status

        updated.append(task)

    if updated:
        db.commit()
    return updated


def delete_tasks_from_ai(db: Session, task_ids: list, user_id: int = 1) -> list:
    deleted = []
    for tid in task_ids:
        try:
            task = db.query(Task).filter(Task.id == int(tid), Task.user_id == user_id).first()
        except Exception:
            continue
        if task:
            deleted.append(task.title)
            db.delete(task)
    if deleted:
        db.commit()
    return deleted


def delete_all_tasks(db: Session, user_id: int = 1) -> list:
    """Удаляет ВСЕ задачи пользователя напрямую через БД."""
    tasks = db.query(Task).filter(Task.user_id == user_id).all()
    titles = [t.title for t in tasks]
    db.query(Task).filter(Task.user_id == user_id).delete()
    db.commit()
    return titles


def parse_agent_response(text: str) -> dict:
    text = re.sub(r"```(?:json)?", "", text).strip().rstrip("`").strip()
    try:
        return json.loads(text)
    except Exception:
        pass
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end > start:
        try:
            return json.loads(text[start:end+1])
        except Exception:
            pass
    return {
        "message": text or "Готово.",
        "tasks_to_create": [], "tasks_to_update": [], "tasks_to_delete": [],
        "tasks_to_unsorted": [], "clarifying_questions": [],
        "memories_to_save": [], "tips": [], "load_warning": None,
    }


async def call_llm(system_prompt: str, history: list) -> str:
    if USE_OLLAMA:
        return await _call_ollama(system_prompt, history)
    return _call_anthropic(system_prompt, history)


async def call_llm_with_retry(system_prompt: str, history: list) -> str:
    """Вызывает LLM и повторяет запрос если ответ не JSON."""
    raw = await call_llm(system_prompt, history)

    # Проверяем что ответ содержит JSON
    if "{" in raw and "}" in raw:
        return raw

    # Если Qwen вернул обычный текст — просим его переформатировать
    print(f"[Agent] Non-JSON response detected, retrying with JSON reminder...")
    retry_history = history + [
        {"role": "assistant", "content": raw},
        {"role": "user", "content": 'IMPORTANT: Your response must be valid JSON only. Rewrite your response as JSON with the required format: {"message": "...", "tasks_to_create": [], "tasks_to_update": [], "tasks_to_delete": [], "tasks_to_unsorted": [], "clarifying_questions": [], "memories_to_save": [], "tips": [], "load_warning": null}'}
    ]
    raw2 = await call_llm(system_prompt, retry_history)
    print(f"[Agent] RETRY RESPONSE:\n{raw2[:300]}")
    return raw2


def _call_anthropic(system_prompt: str, history: list) -> str:
    if not _client:
        raise RuntimeError("ANTHROPIC_API_KEY не задан в .env")
    if not history:
        raise RuntimeError("История сообщений пуста")
    clean_history = []
    for msg in history:
        if not clean_history or clean_history[-1]["role"] != msg["role"]:
            clean_history.append(msg)
        else:
            clean_history[-1]["content"] += "\n" + msg["content"]

    resp = _client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        system=system_prompt,
        messages=clean_history,
    )
    return resp.content[0].text


async def _call_ollama(system_prompt: str, history: list) -> str:
    messages = [{"role": "system", "content": system_prompt}] + history
    payload = {
        "model": OLLAMA_MODEL,
        "messages": messages,
        "stream": False,
        "options": {
            "temperature": 0.1,
            "num_predict": 1024,
            "num_ctx": 4096
        }
    }

    print(f"[Agent] Sending to Ollama: model={OLLAMA_MODEL}, msgs={len(messages)}")
    async with httpx.AsyncClient(timeout=180.0) as client:
        resp = await client.post(OLLAMA_URL.rstrip("/") + "/api/chat", json=payload)
        resp.raise_for_status()
        return resp.json()["message"]["content"]


async def process_message(db: Session, user_id: int = 1) -> dict:
    # Обновляем просроченные задачи перед каждым запросом к агенту
    refresh_overdue_tasks(db, user_id)

    system_prompt = build_system_prompt(db, user_id)
    history = get_chat_history(db, user_id, limit=10)

    last_user = next((m["content"] for m in reversed(history) if m["role"] == "user"), "—")
    print(f"\n{'='*60}")
    print(f"[Agent] msgs in history: {len(history)}")
    print(f"[Agent] last user msg: {last_user[:120]}")

    # ── Проверяем "удали все" ДО вызова LLM ──────────────────────────
    # Если пользователь явно просит удалить всё — делаем это напрямую
    # не доверяя LLM собрать правильный список ID
    force_delete_all = _detect_delete_all(last_user)

    try:
        raw = await call_llm_with_retry(system_prompt, history)
    except Exception as e:
        print(f"[Agent] LLM ERROR: {e}")
        return {
            "message": f"Ошибка ИИ: {e}",
            "tasks_created": [], "tasks_updated": [], "tasks_deleted": [],
            "clarifying_questions": [], "tips": [], "load_warning": None,
        }

    print(f"[Agent] RAW RESPONSE:\n{raw}")
    print(f"{'='*60}\n")

    parsed = parse_agent_response(raw)
    print(f"[Agent] create={len(parsed.get('tasks_to_create', []))} "
          f"update={len(parsed.get('tasks_to_update', []))} "
          f"delete={parsed.get('tasks_to_delete', [])} ")

    if parsed.get("memories_to_save"):
        save_memories(db, parsed["memories_to_save"], user_id)

    # ── Обработка удаления ────────────────────────────────────────────
    deleted_titles = []

    if force_delete_all:
        # Удаляем напрямую через БД — надёжнее чем полагаться на LLM
        deleted_titles = delete_all_tasks(db, user_id)
        print(f"[Agent] FORCE DELETE ALL: удалено {len(deleted_titles)} задач")
    else:
        # Обычное удаление по ID от LLM
        raw_delete = parsed.get("tasks_to_delete", [])

        # Qwen иногда возвращает "all" строкой — перехватываем
        if raw_delete == "all" or raw_delete == ["all"]:
            deleted_titles = delete_all_tasks(db, user_id)
            print(f"[Agent] DELETE ALL (via 'all' string): удалено {len(deleted_titles)} задач")
        elif isinstance(raw_delete, list) and raw_delete:
            deleted_titles = delete_tasks_from_ai(db, raw_delete, user_id)

    created = create_tasks_from_ai(
        db,
        parsed.get("tasks_to_create", []) + parsed.get("tasks_to_unsorted", []),
        user_id,
        user_message=last_user,
    )
    updated = update_tasks_from_ai(db, parsed.get("tasks_to_update", []), user_id)

    return {
        "message": parsed.get("message") or "Готово.",
        "tasks_created": [{"id": t.id, "title": t.title, "category": t.category, "priority": t.priority} for t in created],
        "tasks_updated": [{"id": t.id, "title": t.title} for t in updated],
        "tasks_deleted": deleted_titles,
        "clarifying_questions": parsed.get("clarifying_questions", []),
        "tips": parsed.get("tips", []),
        "load_warning": parsed.get("load_warning"),
    }