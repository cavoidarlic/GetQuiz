from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.config import settings
from routers import quizzes, sessions, history
from models.database import create_db_and_tables

# Initialize FastAPI instance
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Backend API to generate AI Quizzes"
)

# Startup event to initialize database
@app.on_event("startup")
def on_startup():
    create_db_and_tables()

# Configure CORS to allow frontend requests from different origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include sub-routers into the main app
app.include_router(quizzes.router)
app.include_router(sessions.router)
app.include_router(history.router)

@app.get("/")
async def root():
    return {"message": "Welcome to GetQuiz AI API. Visit /docs for more info"}
