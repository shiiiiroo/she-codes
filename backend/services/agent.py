"""
AI Agent Service — core of TaskFlow.
Handles: task extraction, prioritization, categorization,
duration estimation, user memory, tips, load analysis.
"""
import json
import re
from datetime import datetime, timedelta
from typing import Optional
from anthropic import Anthropic
from sqlalchemy.orm import Session
from database import Task, UserProfile, AIMemory, ChatMessage

client = Anthropic()

AGENT_SYSTEM = """You are TaskFlow AI — an intelligent personal task management assistant.

Your capabilities:
1. Extract tasks from natural language or voice transcripts
2. Prioritize tasks (critical/high/medium/low) based on urgency, deadlines, user context
3. Categorize tasks: work, study, health, personal, finance, social, unsorted
4. Estimate task duration in minutes (realistic, based on task type)
5. Remember facts about the user and use them in future responses
6. Give actionable tips about workload, deadlines, productivity
7. Ask clarifying questions when info is insufficient
8. Suggest postponing overdue tasks to appropriate future slots

RESPONSE FORMAT:
Always respond with valid JSON in this exact structure:
{
  "message": "Your conversational reply to the user (friendly, concise)",
  "tasks_to_create": [
    {
      "title": "Task title",
      "description": "Optional details",
      "category": "work|study|health|personal|finance|social|unsorted",
      "priority": "critical|high|medium|low",
      "duration_minutes": 60,
      "start_datetime": "2025-02-21T14:00:00" or null,
      "deadline": "2025-02-22T18:00:00" or null,
      "urgency_score": 0.8,
      "ai_notes": "Why this priority/category was chosen",
      "subtasks": ["subtask 1", "subtask 2"]
    }
  ],
  "tasks_to_unsorted": [
    {
      "title": "Task with insufficient info",
      "description": "What info is missing",
      "category": "unsorted"
    }
  ],
  "clarifying_questions": ["Question if more info needed"],
  "memories_to_save": [
    {"key": "fact_key", "value": "fact_value", "type": "preference|fact|pattern"}
  ],
  "tips": ["Tip about workload or tasks"],
  "load_warning": null or "Warning if user is overloaded"
}

Rules:
- Today's date: {today}
- User context: {user_context}
- Existing tasks today: {tasks_today}
- User memory: {user_memory}
- ALWAYS respond in the same language the user writes in
- If user writes in Russian, respond in Russian
- Be warm, concise, practical
- Duration estimates: email=15min, meeting=60min, report=120min, quick call=10min, exercise=45min
- Mark as "unsorted" only if truly missing critical info (what/when)
- urgency_score: 0.0=no rush, 1.0=on fire
"""


def get_user_context(db: Session, user_id: int = 1) -> dict:
    user = db.query(UserProfile).filter(UserProfile.id == user_id).first()
    if not user:
        return {}
    return {
        "name": user.name,
        "occupation": user.occupation,
        "workplace": user.workplace,
        "work_schedule": user.work_schedule,
        "study_schedule": user.study_schedule,
        "max_daily_hours": user.max_daily_hours,
        "health_notes": user.health_notes,
        "wake_time": user.wake_time,
        "sleep_time": user.sleep_time,
    }


def get_user_memory(db: Session, user_id: int = 1) -> str:
    memories = db.query(AIMemory).filter(AIMemory.user_id == user_id).all()
    if not memories:
        return "No memory yet."
    mem_dict = {m.key: m.value for m in memories}
    return json.dumps(mem_dict, ensure_ascii=False)


def get_tasks_today(db: Session, user_id: int = 1) -> list:
    today = datetime.utcnow().date()
    tasks = db.query(Task).filter(
        Task.user_id == user_id,
        Task.status != "completed",
    ).all()
    today_tasks = [t for t in tasks if t.start_datetime and t.start_datetime.date() == today]
    return [{"title": t.title, "priority": t.priority, "duration_minutes": t.duration_minutes} for t in today_tasks]


def build_system_prompt(db: Session, user_id: int = 1) -> str:
    user_ctx = get_user_context(db, user_id)
    user_mem = get_user_memory(db, user_id)
    tasks_today = get_tasks_today(db, user_id)
    today = datetime.utcnow().strftime("%Y-%m-%d %H:%M")

    return AGENT_SYSTEM.format(
        today=today,
        user_context=json.dumps(user_ctx, ensure_ascii=False),
        tasks_today=json.dumps(tasks_today, ensure_ascii=False),
        user_memory=user_mem,
    )


def get_chat_history(db: Session, user_id: int = 1, limit: int = 20) -> list:
    msgs = (
        db.query(ChatMessage)
        .filter(ChatMessage.user_id == user_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(limit)
        .all()
    )
    msgs.reverse()
    return [{"role": m.role, "content": m.content} for m in msgs]


def save_message(db: Session, role: str, content: str, user_id: int = 1,
                 msg_type: str = "text", metadata: dict = None):
    msg = ChatMessage(
        user_id=user_id,
        role=role,
        content=content,
        message_type=msg_type,
        meta=metadata or {},
    )
    db.add(msg)
    db.commit()


def save_memories(db: Session, memories: list, user_id: int = 1):
    for mem in memories:
        existing = db.query(AIMemory).filter(
            AIMemory.user_id == user_id,
            AIMemory.key == mem.get("key"),
        ).first()
        if existing:
            existing.value = mem.get("value", "")
            existing.updated_at = datetime.utcnow()
        else:
            new_mem = AIMemory(
                user_id=user_id,
                memory_type=mem.get("type", "fact"),
                key=mem.get("key", ""),
                value=mem.get("value", ""),
            )
            db.add(new_mem)
    db.commit()


def create_tasks_from_ai(db: Session, tasks_data: list, user_id: int = 1) -> list:
    created = []
    for td in tasks_data:
        task = Task(
            user_id=user_id,
            title=td.get("title", "Unnamed task"),
            description=td.get("description"),
            category=td.get("category", "unsorted"),
            priority=td.get("priority", "medium"),
            status="pending",
            duration_minutes=td.get("duration_minutes"),
            urgency_score=td.get("urgency_score", 0.5),
            ai_notes=td.get("ai_notes"),
            ai_generated=True,
            subtasks=[{"title": s, "done": False} for s in td.get("subtasks", [])],
        )
        # Parse datetimes
        if td.get("start_datetime"):
            try:
                task.start_datetime = datetime.fromisoformat(td["start_datetime"])
            except Exception:
                pass
        if td.get("deadline"):
            try:
                task.deadline = datetime.fromisoformat(td["deadline"])
            except Exception:
                pass
        if task.start_datetime and task.duration_minutes:
            task.end_datetime = task.start_datetime + timedelta(minutes=task.duration_minutes)
        db.add(task)
        created.append(task)
    db.commit()
    for t in created:
        db.refresh(t)
    return created


def parse_agent_response(text: str) -> dict:
    """Extract JSON from agent response, even if wrapped in markdown."""
    # Try direct parse first
    try:
        return json.loads(text)
    except Exception:
        pass
    # Extract JSON block
    match = re.search(r'\{[\s\S]*\}', text)
    if match:
        try:
            return json.loads(match.group())
        except Exception:
            pass
    # Fallback
    return {
        "message": text,
        "tasks_to_create": [],
        "tasks_to_unsorted": [],
        "clarifying_questions": [],
        "memories_to_save": [],
        "tips": [],
        "load_warning": None,
    }


async def process_message(
    user_message: str,
    db: Session,
    user_id: int = 1,
    msg_type: str = "text",
) -> dict:
    """Main agent entry point. Returns structured response."""

    system_prompt = build_system_prompt(db, user_id)
    history = get_chat_history(db, user_id)

    # Save user message
    save_message(db, "user", user_message, user_id, msg_type)

    # Call Claude
    history.append({"role": "user", "content": user_message})

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2048,
        system=system_prompt,
        messages=history,
    )

    raw = response.content[0].text
    parsed = parse_agent_response(raw)

    # Persist AI message
    save_message(db, "assistant", parsed.get("message", raw), user_id, metadata=parsed)

    # Save memories
    if parsed.get("memories_to_save"):
        save_memories(db, parsed["memories_to_save"], user_id)

    # Create tasks
    all_task_data = parsed.get("tasks_to_create", []) + parsed.get("tasks_to_unsorted", [])
    created_tasks = []
    if all_task_data:
        created_tasks = create_tasks_from_ai(db, all_task_data, user_id)

    return {
        "message": parsed.get("message", ""),
        "tasks_created": [{"id": t.id, "title": t.title, "category": t.category, "priority": t.priority} for t in created_tasks],
        "clarifying_questions": parsed.get("clarifying_questions", []),
        "tips": parsed.get("tips", []),
        "load_warning": parsed.get("load_warning"),
    }
