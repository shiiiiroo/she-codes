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

class SubtaskSchema(BaseModel):
    title: str
    done: bool = False


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
    view: str = Query("day", description="day|week|month|year"),
    date_str: Optional[str] = Query(None, description="YYYY-MM-DD"),
    category: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Get tasks for calendar view (day/week/month/year)."""
    user_id = 1
    target_date = date.fromisoformat(date_str) if date_str else date.today()
    query = db.query(Task).filter(Task.user_id == user_id)

    if category:
        query = query.filter(Task.category == category)
    if status:
        query = query.filter(Task.status == status)

    # Date range filtering
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

    tasks = query.filter(
        or_(
            and_(Task.start_datetime >= start, Task.start_datetime < end),
            and_(Task.deadline >= start, Task.deadline < end),
            Task.start_datetime.is_(None),  # unsorted tasks
        )
    ).order_by(Task.start_datetime.asc()).all()

    return {
        "tasks": [task_to_dict(t) for t in tasks],
        "view": view,
        "date": str(target_date),
    }


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
        subtasks=[{"title": s["title"] if isinstance(s, dict) else s, "done": False} for s in (task_in.subtasks or [])],
        is_recurring=task_in.is_recurring,
        recurrence_rule=task_in.recurrence_rule,
        ai_generated=False,
    )
    if task.start_datetime and task.duration_minutes and not task.end_datetime:
        task.end_datetime = task.start_datetime + timedelta(minutes=task.duration_minutes)
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
    task.updated_at = datetime.utcnow()
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
    task.completed_at = datetime.utcnow()
    task.updated_at = datetime.utcnow()
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
    task.updated_at = datetime.utcnow()
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
    task.updated_at = datetime.utcnow()
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
