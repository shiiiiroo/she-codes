from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime, date, timedelta
from typing import Optional, List
from pydantic import BaseModel
from database import get_db, Task, DailyStats
from services.load_analyzer import update_daily_stats, generate_tips, get_overdue_tasks, calculate_day_load

router = APIRouter(prefix="/tasks", tags=["tasks"])


# ─── SCHEMAS ──────────────────────────────────────────────────────────────────

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    category: str = "unsorted"
    priority: str = "medium"
    duration_minutes: Optional[int] = None
    start_datetime: Optional[datetime] = None
    end_datetime: Optional[datetime] = None
    deadline: Optional[datetime] = None
    subtasks: Optional[List[dict]] = []
    is_recurring: bool = False
    recurrence_rule: Optional[str] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    duration_minutes: Optional[int] = None
    start_datetime: Optional[datetime] = None
    end_datetime: Optional[datetime] = None
    deadline: Optional[datetime] = None
    subtasks: Optional[List[dict]] = None


def is_task_overdue(task: Task) -> bool:
    """
    Задача просрочена если:
    - start_datetime + duration_minutes < сейчас, ИЛИ
    - deadline < сейчас
    И задача не выполнена.
    """
    if task.status == "completed":
        return False

    now = datetime.now()

    # Главное правило: начало + длительность уже прошли
    if task.start_datetime and task.duration_minutes:
        end_time = task.start_datetime + timedelta(minutes=task.duration_minutes)
        if end_time < now:
            return True

    # Дедлайн прошёл
    if task.deadline and task.deadline < now:
        return True

    return False


def auto_update_status(task: Task) -> bool:
    """Обновляет статус задачи если она просрочена. Возвращает True если изменился."""
    if task.status in ("completed", "postponed"):
        return False
    if is_task_overdue(task):
        if task.status != "overdue":
            task.status = "overdue"
            return True
    else:
        # Если задача была overdue но теперь нет (например перенесли) — вернуть pending
        if task.status == "overdue":
            task.status = "pending"
            return True
    return False


def task_to_dict(t: Task) -> dict:
    return {
        "id": t.id,
        "title": t.title,
        "description": t.description,
        "category": t.category,
        "priority": t.priority,
        "status": t.status,
        "duration_minutes": t.duration_minutes,
        "start_datetime": t.start_datetime.isoformat() if t.start_datetime else None,
        "end_datetime": t.end_datetime.isoformat() if t.end_datetime else None,
        "deadline": t.deadline.isoformat() if t.deadline else None,
        "urgency_score": t.urgency_score,
        "ai_generated": t.ai_generated,
        "ai_notes": t.ai_notes,
        "subtasks": t.subtasks or [],
        "is_recurring": t.is_recurring,
        "recurrence_rule": t.recurrence_rule,
        "completed_at": t.completed_at.isoformat() if t.completed_at else None,
        "created_at": t.created_at.isoformat(),
    }


# ─── ENDPOINTS ────────────────────────────────────────────────────────────────

@router.get("/")
def get_tasks(
    view: str = Query("day"),
    date_str: Optional[str] = Query(None),
    category: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    user_id = 1
    target_date = date.fromisoformat(date_str) if date_str else date.today()
    today_start = datetime.combine(date.today(), datetime.min.time())

    # Build date range for the view
    if view == "day":
        start = datetime.combine(target_date, datetime.min.time())
        end = start + timedelta(days=1)
    elif view == "week":
        monday = target_date - timedelta(days=target_date.weekday())
        start = datetime.combine(monday, datetime.min.time())
        end = start + timedelta(days=7)
    elif view == "month":
        start = datetime.combine(date(target_date.year, target_date.month, 1), datetime.min.time())
        if target_date.month == 12:
            end = datetime.combine(date(target_date.year + 1, 1, 1), datetime.min.time())
        else:
            end = datetime.combine(date(target_date.year, target_date.month + 1, 1), datetime.min.time())
    elif view == "year":
        start = datetime.combine(date(target_date.year, 1, 1), datetime.min.time())
        end = datetime.combine(date(target_date.year + 1, 1, 1), datetime.min.time())
    else:
        start = datetime.combine(target_date, datetime.min.time())
        end = start + timedelta(days=1)

    base_query = db.query(Task).filter(Task.user_id == user_id)
    if category:
        base_query = base_query.filter(Task.category == category)
    if status:
        base_query = base_query.filter(Task.status == status)

    all_tasks = base_query.all()

    # Автоматически обновляем статусы просроченных задач
    changed = False
    for task in all_tasks:
        if auto_update_status(task):
            task.updated_at = datetime.now()
            changed = True
    if changed:
        db.commit()

    # 1. Tasks that START within the period
    in_period = [
        t for t in all_tasks
        if t.start_datetime and start <= t.start_datetime < end
    ]

    # 2. Tasks with deadline in period but no start_datetime
    deadline_only = [
        t for t in all_tasks
        if t.deadline
        and not t.start_datetime
        and start <= t.deadline < end
    ]

    # 3. Overdue tasks not already in period — показываем в текущем виде
    in_period_ids = {t.id for t in in_period} | {t.id for t in deadline_only}
    overdue_floating = [
        t for t in all_tasks
        if t.status == "overdue"
        and t.id not in in_period_ids
    ]

    # Combine scheduled tasks
    scheduled_ids = in_period_ids | {t.id for t in overdue_floating}
    scheduled = in_period + deadline_only + overdue_floating

    # 4. Undated tasks: no start_datetime, no deadline, not completed
    undated = [
        t for t in all_tasks
        if not t.start_datetime
        and not t.deadline
        and t.status not in ("completed",)
        and t.id not in scheduled_ids
    ]

    scheduled.sort(key=lambda t: (
        t.start_datetime or t.deadline or datetime.max
    ))

    return {
        "tasks": [task_to_dict(t) for t in scheduled],
        "undated": [task_to_dict(t) for t in undated],
        "view": view,
        "date": str(target_date),
    }


@router.get("/undated")
def get_undated(db: Session = Depends(get_db)):
    tasks = db.query(Task).filter(
        Task.user_id == 1,
        Task.start_datetime.is_(None),
        Task.deadline.is_(None),
        Task.status != "completed",
    ).order_by(Task.created_at.desc()).all()
    return [task_to_dict(t) for t in tasks]


@router.get("/unsorted")
def get_unsorted(db: Session = Depends(get_db)):
    tasks = db.query(Task).filter(
        Task.user_id == 1,
        Task.category == "unsorted",
        Task.status != "completed",
    ).all()
    return [task_to_dict(t) for t in tasks]


@router.get("/overdue")
def get_overdue(db: Session = Depends(get_db)):
    tasks = get_overdue_tasks(db, user_id=1)
    return [task_to_dict(t) for t in tasks]


@router.get("/tips")
def get_tips(db: Session = Depends(get_db)):
    tips = generate_tips(db, user_id=1)
    today = date.today()
    load = calculate_day_load(db, today, user_id=1)
    return {"tips": tips, "load": load}


@router.get("/load/{date_str}")
def get_load(date_str: str, db: Session = Depends(get_db)):
    target = date.fromisoformat(date_str)
    return calculate_day_load(db, target, user_id=1)


@router.post("/")
def create_task(task_in: TaskCreate, db: Session = Depends(get_db)):
    task = Task(
        user_id=1,
        title=task_in.title,
        description=task_in.description,
        category=task_in.category,
        priority=task_in.priority,
        duration_minutes=task_in.duration_minutes,
        start_datetime=task_in.start_datetime,
        end_datetime=task_in.end_datetime,
        deadline=task_in.deadline,
        subtasks=[
            {"title": s["title"] if isinstance(s, dict) else s, "done": False}
            for s in (task_in.subtasks or [])
        ],
        is_recurring=task_in.is_recurring,
        recurrence_rule=task_in.recurrence_rule,
        ai_generated=False,
    )
    if task.start_datetime and task_in.duration_minutes and not task.end_datetime:
        task.end_datetime = task.start_datetime + timedelta(minutes=task_in.duration_minutes)

    # Проверяем сразу при создании
    task.status = "overdue" if is_task_overdue(task) else "pending"

    db.add(task)
    db.commit()
    db.refresh(task)
    update_daily_stats(db, user_id=1)
    return task_to_dict(task)


@router.get("/{task_id}")
def get_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id, Task.user_id == 1).first()
    if not task:
        raise HTTPException(404, "Task not found")
    return task_to_dict(task)


@router.patch("/{task_id}")
def update_task(task_id: int, updates: TaskUpdate, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id, Task.user_id == 1).first()
    if not task:
        raise HTTPException(404, "Task not found")

    for field, value in updates.dict(exclude_none=True).items():
        setattr(task, field, value)

    # Если статус явно не передан — пересчитываем автоматически
    if updates.status is None:
        task.status = "overdue" if is_task_overdue(task) else (task.status if task.status != "overdue" else "pending")
    elif updates.status in ("pending", "in_progress"):
        task.completed_at = None

    task.updated_at = datetime.now()
    db.commit()
    db.refresh(task)
    update_daily_stats(db, user_id=1)
    return task_to_dict(task)


@router.post("/{task_id}/complete")
def complete_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id, Task.user_id == 1).first()
    if not task:
        raise HTTPException(404, "Task not found")
    task.status = "completed"
    task.completed_at = datetime.now()
    task.updated_at = datetime.now()
    db.commit()
    update_daily_stats(db, user_id=1)
    return {"ok": True, "task_id": task_id}


@router.post("/{task_id}/postpone")
def postpone_task(task_id: int, new_date: str, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id, Task.user_id == 1).first()
    if not task:
        raise HTTPException(404, "Task not found")
    new_dt = datetime.fromisoformat(new_date)
    if task.start_datetime:
        duration = task.duration_minutes or 60
        task.start_datetime = new_dt
        task.end_datetime = new_dt + timedelta(minutes=duration)
    if task.deadline:
        task.deadline = new_dt
    task.status = "postponed"
    task.updated_at = datetime.now()
    db.commit()
    update_daily_stats(db, user_id=1)
    return task_to_dict(task)


@router.patch("/{task_id}/subtasks/{sub_idx}")
def toggle_subtask(task_id: int, sub_idx: int, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id, Task.user_id == 1).first()
    if not task:
        raise HTTPException(404, "Task not found")
    subs = list(task.subtasks or [])
    if sub_idx >= len(subs):
        raise HTTPException(400, "Subtask index out of range")
    subs[sub_idx]["done"] = not subs[sub_idx]["done"]
    task.subtasks = subs
    task.updated_at = datetime.now()
    db.commit()
    return task_to_dict(task)


@router.delete("/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id, Task.user_id == 1).first()
    if not task:
        raise HTTPException(404, "Task not found")
    db.delete(task)
    db.commit()
    update_daily_stats(db, user_id=1)
    return {"ok": True}