from sqlalchemy import create_engine, Column, Integer, String, Text, Boolean, DateTime, Float, JSON, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime, timezone
import enum
import os

# Абсолютный путь к БД — всегда рядом с database.py
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_URL = f"sqlite:///{os.path.join(BASE_DIR, 'taskflow.db')}"

print(f"[DB] База данных: {os.path.join(BASE_DIR, 'taskflow.db')}")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class PriorityEnum(str, enum.Enum):
    critical = "critical"
    high = "high"
    medium = "medium"
    low = "low"


class CategoryEnum(str, enum.Enum):
    work = "work"
    study = "study"
    health = "health"
    personal = "personal"
    finance = "finance"
    social = "social"
    unsorted = "unsorted"


class StatusEnum(str, enum.Enum):
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"
    overdue = "overdue"
    postponed = "postponed"


# ─── MODELS ───────────────────────────────────────────────────────────────────

class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), default="User")
    email = Column(String(200), nullable=True)
    avatar_url = Column(String(500), nullable=True)

    occupation = Column(String(200), nullable=True)
    workplace = Column(String(200), nullable=True)
    work_schedule = Column(JSON, nullable=True)
    study_schedule = Column(JSON, nullable=True)

    max_daily_hours = Column(Float, default=8.0)
    health_notes = Column(Text, nullable=True)
    wake_time = Column(String(10), default="08:00")
    sleep_time = Column(String(10), default="23:00")

    ai_memory = Column(Text, nullable=True)
    preferences = Column(JSON, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc))

    tasks = relationship("Task", back_populates="user")
    chat_messages = relationship("ChatMessage", back_populates="user")
    ai_memories = relationship("AIMemory", back_populates="user")


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("user_profiles.id"), default=1)

    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(50), default="unsorted")
    priority = Column(String(20), default="medium")
    status = Column(String(20), default="pending")

    start_datetime = Column(DateTime, nullable=True)
    end_datetime = Column(DateTime, nullable=True)
    duration_minutes = Column(Integer, nullable=True)
    deadline = Column(DateTime, nullable=True)

    ai_generated = Column(Boolean, default=False)
    ai_notes = Column(Text, nullable=True)
    urgency_score = Column(Float, default=0.5)

    subtasks = Column(JSON, default=list)
    attached_files = Column(JSON, default=list)

    is_recurring = Column(Boolean, default=False)
    recurrence_rule = Column(String(100), nullable=True)

    completed_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc))

    user = relationship("UserProfile", back_populates="tasks")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("user_profiles.id"), default=1)
    role = Column(String(20))
    content = Column(Text)
    message_type = Column(String(20), default="text")
    file_path = Column(String(500), nullable=True)
    meta = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("UserProfile", back_populates="chat_messages")


class AIMemory(Base):
    __tablename__ = "ai_memories"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("user_profiles.id"), default=1)
    memory_type = Column(String(50))
    key = Column(String(200))
    value = Column(Text)
    confidence = Column(Float, default=1.0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc))

    user = relationship("UserProfile", back_populates="ai_memories")


class DailyStats(Base):
    __tablename__ = "daily_stats"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("user_profiles.id"), default=1)
    date = Column(String(10))
    tasks_total = Column(Integer, default=0)
    tasks_completed = Column(Integer, default=0)
    tasks_overdue = Column(Integer, default=0)
    tasks_postponed = Column(Integer, default=0)
    total_minutes_planned = Column(Integer, default=0)
    total_minutes_done = Column(Integer, default=0)
    load_score = Column(Float, default=0.0)
    all_done = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


def create_tables():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        user = db.query(UserProfile).first()
        if not user:
            default_user = UserProfile(
                name="User",
                max_daily_hours=8.0,
                wake_time="08:00",
                sleep_time="23:00",
                ai_memory="{}",
                preferences={},
            )
            db.add(default_user)
            db.commit()
            print("[DB] Создан пользователь по умолчанию")
    finally:
        db.close()