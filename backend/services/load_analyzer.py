"""
Load analysis, tips generation, overdue detection.
"""
from datetime import datetime, date, timedelta
from sqlalchemy.orm import Session
from database import Task, UserProfile, DailyStats


def calculate_day_load(db: Session, target_date: date, user_id: int = 1) -> dict:
    """Returns load metrics for a given day."""
    user = db.query(UserProfile).filter(UserProfile.id == user_id).first()
    max_minutes = (user.max_daily_hours if user else 8.0) * 60

    tasks = db.query(Task).filter(
        Task.user_id == user_id,
        Task.status != "completed",
    ).all()

    day_tasks = [
        t for t in tasks
        if t.start_datetime and t.start_datetime.date() == target_date
    ]

    planned_minutes = sum(t.duration_minutes or 30 for t in day_tasks)
    critical = [t for t in day_tasks if t.priority == "critical"]
    high = [t for t in day_tasks if t.priority == "high"]

    load_pct = min(planned_minutes / max_minutes, 1.5) if max_minutes else 0
    overloaded = load_pct > 1.0

    return {
        "date": str(target_date),
        "tasks_count": len(day_tasks),
        "planned_minutes": planned_minutes,
        "max_minutes": int(max_minutes),
        "load_percent": round(load_pct * 100),
        "overloaded": overloaded,
        "critical_count": len(critical),
        "high_count": len(high),
    }


def get_overdue_tasks(db: Session, user_id: int = 1) -> list:
    now = datetime.utcnow()
    tasks = db.query(Task).filter(
        Task.user_id == user_id,
        Task.status == "pending",
    ).all()
    overdue = []
    for t in tasks:
        if t.deadline and t.deadline < now:
            overdue.append(t)
        elif t.start_datetime and t.end_datetime and t.end_datetime < now:
            overdue.append(t)
    return overdue


def generate_tips(db: Session, user_id: int = 1) -> list[str]:
    tips = []
    today = date.today()
    load = calculate_day_load(db, today, user_id)
    overdue = get_overdue_tasks(db, user_id)

    if load["overloaded"]:
        tips.append(
            f"⚠️ Сегодня запланировано {load['planned_minutes']} мин "
            f"из максимума {load['max_minutes']} мин. Рассмотрите перенос части задач."
        )

    if overdue:
        titles = ", ".join(t.title for t in overdue[:3])
        tips.append(f"🔴 Просрочено задач: {len(overdue)}. Например: {titles}. Хотите перенести?")

    if load["critical_count"] > 0:
        tips.append(f"🔥 Сегодня {load['critical_count']} критических задач. Начните с них!")

    tomorrow = today + timedelta(days=1)
    tomorrow_load = calculate_day_load(db, tomorrow, user_id)
    if tomorrow_load["tasks_count"] == 0 and overdue:
        tips.append("💡 Завтра у вас свободно — можно перенести просроченные задачи туда.")

    if not tips:
        if load["tasks_count"] == 0:
            tips.append("✅ На сегодня задач нет. Самое время запланировать день!")
        else:
            tips.append(f"👍 Загрузка: {load['load_percent']}%. Отличный темп!")

    return tips


def update_daily_stats(db: Session, user_id: int = 1, target_date: date = None):
    """Snapshot today's stats into DailyStats table."""
    if target_date is None:
        target_date = date.today()
    date_str = str(target_date)

    all_tasks = db.query(Task).filter(Task.user_id == user_id).all()
    day_tasks = [
        t for t in all_tasks
        if (t.start_datetime and t.start_datetime.date() == target_date)
        or (t.deadline and t.deadline.date() == target_date)
    ]

    completed = [t for t in day_tasks if t.status == "completed"]
    overdue = [
        t for t in day_tasks
        if t.status == "pending" and t.deadline and t.deadline.date() < target_date
    ]
    planned_min = sum(t.duration_minutes or 30 for t in day_tasks)
    done_min = sum(t.duration_minutes or 30 for t in completed)

    # Правильный расчёт load_score: отношение запланированного к максимуму (0.0 - 1.5+)
    user = db.query(UserProfile).filter(UserProfile.id == user_id).first()
    max_minutes = (user.max_daily_hours if user else 8.0) * 60
    load_score = min(planned_min / max_minutes, 1.5) if max_minutes > 0 else 0.0

    all_done = len(day_tasks) > 0 and len(completed) == len(day_tasks)

    existing = db.query(DailyStats).filter(
        DailyStats.user_id == user_id,
        DailyStats.date == date_str,
    ).first()

    if existing:
        existing.tasks_total = len(day_tasks)
        existing.tasks_completed = len(completed)
        existing.tasks_overdue = len(overdue)
        existing.total_minutes_planned = planned_min
        existing.total_minutes_done = done_min
        existing.load_score = load_score
        existing.all_done = all_done
    else:
        stats = DailyStats(
            user_id=user_id,
            date=date_str,
            tasks_total=len(day_tasks),
            tasks_completed=len(completed),
            tasks_overdue=len(overdue),
            total_minutes_planned=planned_min,
            total_minutes_done=done_min,
            load_score=load_score,
            all_done=all_done,
        )
        db.add(stats)
    db.commit()