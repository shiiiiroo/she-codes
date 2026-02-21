from sqlalchemy import create_engine, Column, Integer, String, Text, Boolean, DateTime, Float, JSON, ForeignKey, Enum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import enum

DATABASE_URL = "sqlite:///./taskflow.db"

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

    # Work/Study info
    occupation = Column(String(200), nullable=True)        # "developer", "student", etc.
    workplace = Column(String(200), nullable=True)
    work_schedule = Column(JSON, nullable=True)            # {"mon": "09:00-18:00", "fri": "09:00-17:00"}
    study_schedule = Column(JSON, nullable=True)

    # Health / load preferences
    max_daily_hours = Column(Float, default=8.0)           # max working hours per day
    health_notes = Column(Text, nullable=True)             # e.g. "back pain, need breaks"
    wake_time = Column(String(10), default="08:00")
    sleep_time = Column(String(10), default="23:00")

    # AI memory — accumulated over time
    ai_memory = Column(Text, nullable=True)                # JSON blob of facts about user
    preferences = Column(JSON, nullable=True)              # UI + task preferences

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

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

    # Timing
    start_datetime = Column(DateTime, nullable=True)
    end_datetime = Column(DateTime, nullable=True)
    duration_minutes = Column(Integer, nullable=True)      # AI estimated duration
    deadline = Column(DateTime, nullable=True)

    # AI metadata
    ai_generated = Column(Boolean, default=False)
    ai_notes = Column(Text, nullable=True)                 # AI reasoning about this task
    urgency_score = Column(Float, default=0.5)             # 0.0 - 1.0

    # Subtasks
    subtasks = Column(JSON, default=list)                  # [{"title": "...", "done": false}]

    # Files attached
    attached_files = Column(JSON, default=list)

    # Recurrence
    is_recurring = Column(Boolean, default=False)
    recurrence_rule = Column(String(100), nullable=True)   # "daily", "weekly:mon,wed"

    # Completion
    completed_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("UserProfile", back_populates="tasks")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("user_profiles.id"), default=1)
    role = Column(String(20))                              # "user" | "assistant"
    content = Column(Text)
    message_type = Column(String(20), default="text")     # "text" | "voice" | "file"
    file_path = Column(String(500), nullable=True)
    meta = Column(JSON, nullable=True)                     # e.g. tasks created, tips given
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("UserProfile", back_populates="chat_messages")


class AIMemory(Base):
    __tablename__ = "ai_memories"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("user_profiles.id"), default=1)
    memory_type = Column(String(50))                       # "preference", "fact", "pattern", "tip"
    key = Column(String(200))
    value = Column(Text)
    confidence = Column(Float, default=1.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("UserProfile", back_populates="ai_memories")


class DailyStats(Base):
    __tablename__ = "daily_stats"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("user_profiles.id"), default=1)
    date = Column(String(10))                              # "2025-02-21"
    tasks_total = Column(Integer, default=0)
    tasks_completed = Column(Integer, default=0)
    tasks_overdue = Column(Integer, default=0)
    tasks_postponed = Column(Integer, default=0)
    total_minutes_planned = Column(Integer, default=0)
    total_minutes_done = Column(Integer, default=0)
    load_score = Column(Float, default=0.0)                # 0-1 overload indicator
    all_done = Column(Boolean, default=False)              # for streak calculation
    created_at = Column(DateTime, default=datetime.utcnow)


def create_tables():
    Base.metadata.create_all(bind=engine)
    # Seed default user if not exists
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
    finally:
        db.close()
