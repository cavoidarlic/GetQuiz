import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from core.config import settings
from routers import quizzes, sessions, history
from models.database import create_db_and_tables

# ── App init ──────────────────────────────────────────────────────────────────
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Backend API to generate AI Quizzes",
)

# ── Startup ───────────────────────────────────────────────────────────────────
@app.on_event("startup")
def on_startup():
    create_db_and_tables()

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── API routers ───────────────────────────────────────────────────────────────
app.include_router(quizzes.router)
app.include_router(sessions.router)
app.include_router(history.router)

# ── Health check (used by Render & uptime monitors) ───────────────────────────
@app.get("/ping", tags=["Health"])
async def ping():
    """Lightweight liveness probe — never spins up the DB."""
    return {"status": "ok"}

# ── Static SPA serving (production only) ──────────────────────────────────────
# The build script copies frontend/dist → backend/static/ before startup.
# When that directory exists FastAPI serves the React app for every
# non-API path, enabling full client-side routing via React Router.
_STATIC = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")

if os.path.isdir(_STATIC):
    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str):
        """Serve Vite static assets, or fall back to index.html (SPA routing)."""
        # Try to return an exact file first (JS chunks, CSS, images, favicon…)
        candidate = os.path.join(_STATIC, full_path)
        if full_path and os.path.isfile(candidate):
            return FileResponse(candidate)
        # Everything else (including /) → React takes over client-side routing
        return FileResponse(os.path.join(_STATIC, "index.html"))
else:
    # Local dev: handy API info at root
    @app.get("/")
    async def root():
        return {"message": "Welcome to GetQuiz AI API. Visit /docs for interactive docs."}
