from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from dotenv import load_dotenv
import os

# Загружаем .env ДО импорта всего остального
load_dotenv()

from database import create_tables
from routers.tasks import router as tasks_router
from routers.ai_agent import router as ai_router
from routers.profile_stats import profile_router, stats_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()
    yield


app = FastAPI(
    title="TaskFlow API",
    description="AI-powered personal task management",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tasks_router)
app.include_router(ai_router)
app.include_router(profile_router)
app.include_router(stats_router)


@app.get("/")
def root():
    return {"status": "ok", "service": "TaskFlow API"}

@app.get("/health")
def health():
    return {"status": "healthy"}

@app.get("/debug/env")
def debug_env():
    """Проверка что ключи загружены"""
    key = os.getenv("ANTHROPIC_API_KEY", "")
    return {
        "anthropic_key_set": bool(key),
        "anthropic_key_prefix": key[:12] + "..." if key else "NOT SET",
        "openai_key_set": bool(os.getenv("OPENAI_API_KEY", "")),
    }
