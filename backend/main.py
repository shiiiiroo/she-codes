from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
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
