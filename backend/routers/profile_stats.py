from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, timedelta
from typing import Optional
from pydantic import BaseModel
from database import get_db, UserProfile, AIMemory, DailyStats, Task

profile_router = APIRouter(prefix="/profile", tags=["profile"])
stats_router = APIRouter(prefix="/stats", tags=["stats"])


# ─── PROFILE ─────────────────────────────────────────────────────────────────

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    occupation: Optional[str] = None
    workplace: Optional[str] = None
    work_schedule: Optional[dict] = None
    study_schedule: Optional[dict] = None
    max_daily_hours: Optional[float] = None
    health_notes: Optional[str] = None
    wake_time: Optional[str] = None
    sleep_time: Optional[str] = None
    preferences: Optional[dict] = None


def profile_to_dict(u: UserProfile) -> dict:
    return {
        "id": u.id,
        "name": u.name,
        "email": u.email,
        "occupation": u.occupation,
        "workplace": u.workplace,
        "work_schedule": u.work_schedule,
        "study_schedule": u.study_schedule,
        "max_daily_hours": u.max_daily_hours,
        "health_notes": u.health_notes,
        "wake_time": u.wake_time,
        "sleep_time": u.sleep_time,
        "preferences": u.preferences or {},
        "created_at": u.created_at.isoformat(),
    }


@profile_router.get("/")
def get_profile(db: Session = Depends(get_db)):
    user = db.query(UserProfile).filter(UserProfile.id == 1).first()
    if not user:
        raise HTTPException(404, "Profile not found")
    return profile_to_dict(user)


@profile_router.patch("/")
def update_profile(updates: ProfileUpdate, db: Session = Depends(get_db)):
    user = db.query(UserProfile).filter(UserProfile.id == 1).first()
    if not user:
        raise HTTPException(404, "Profile not found")
    for field, value in updates.dict(exclude_none=True).items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return profile_to_dict(user)


@profile_router.get("/memories")
def get_memories(db: Session = Depends(get_db)):
    mems = db.query(AIMemory).filter(AIMemory.user_id == 1).all()
    return [{"id": m.id, "key": m.key, "value": m.value, "type": m.memory_type} for m in mems]


@profile_router.delete("/memories/{mem_id}")
def delete_memory(mem_id: int, db: Session = Depends(get_db)):
    mem = db.query(AIMemory).filter(AIMemory.id == mem_id, AIMemory.user_id == 1).first()
    if not mem:
        raise HTTPException(404, "Memory not found")
    db.delete(mem)
    db.commit()
    return {"ok": True}


# ─── STATISTICS ──────────────────────────────────────────────────────────────

def calculate_streak(db: Session, user_id: int) -> int:
    # Запрашиваем статистику за последние 90 дней одним махом
    cutoff = date.today() - timedelta(days=90)
    stats = db.query(DailyStats).filter(
        DailyStats.user_id == user_id,
        DailyStats.date >= str(cutoff)
    ).order_by(DailyStats.date.desc()).all()

    streak = 0
    check_date = date.today()
    
    # Превращаем в словарь для быстрого поиска
    stats_dict = {s.date: s.all_done for s in stats}
    
    while stats_dict.get(str(check_date)):
        streak += 1
        check_date -= timedelta(days=1)
    return streak

@stats_router.get("/overview")
def get_overview(db: Session = Depends(get_db)):
    user_id = 1
    all_tasks = db.query(Task).filter(Task.user_id == user_id).all()
    completed = [t for t in all_tasks if t.status == "completed"]
    overdue_list = [t for t in all_tasks if t.status not in ("completed",) and t.deadline and t.deadline.date() < date.today()]

    # Category breakdown
    from collections import Counter
    cat_counts = Counter(t.category for t in all_tasks)
    prio_counts = Counter(t.priority for t in all_tasks)

    streak = calculate_streak(db, user_id)

    return {
        "total_tasks": len(all_tasks),
        "completed": len(completed),
        "overdue": len(overdue_list),
        "pending": len([t for t in all_tasks if t.status == "pending"]),
        "completion_rate": round(len(completed) / len(all_tasks) * 100) if all_tasks else 0,
        "streak_days": streak,
        "by_category": dict(cat_counts),
        "by_priority": dict(prio_counts),
    }


@stats_router.get("/daily")
def get_daily_stats(days: int = 30, db: Session = Depends(get_db)):
    """Last N days of daily stats."""
    user_id = 1
    cutoff = date.today() - timedelta(days=days)
    stats = (
        db.query(DailyStats)
        .filter(DailyStats.user_id == user_id, DailyStats.date >= str(cutoff))
        .order_by(DailyStats.date.asc())
        .all()
    )
    return [
        {
            "date": s.date,
            "total": s.tasks_total,
            "completed": s.tasks_completed,
            "overdue": s.tasks_overdue,
            "load_score": round(s.load_score * 100),
            "all_done": s.all_done,
            "minutes_planned": s.total_minutes_planned,
            "minutes_done": s.total_minutes_done,
        }
        for s in stats
    ]


@stats_router.get("/heatmap")
def get_heatmap(year: int = None, db: Session = Depends(get_db)):
    """GitHub-style heatmap data for a year."""
    if not year:
        year = date.today().year
    stats = (
        db.query(DailyStats)
        .filter(DailyStats.user_id == 1, DailyStats.date.startswith(str(year)))
        .all()
    )
    return {
        s.date: {
            "completed": s.tasks_completed,
            "total": s.tasks_total,
            "all_done": s.all_done,
        }
        for s in stats
    }
