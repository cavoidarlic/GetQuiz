from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Optional
from sqlmodel import Session
from models.database import get_session
from services import db_service
import uuid

router = APIRouter(prefix="/sessions", tags=["Sessions"])


class StartSessionRequest(BaseModel):
    quiz_id: str
    user_id: str = "anonymous"


class AnswerEntry(BaseModel):
    question_id: int
    option_id: Optional[int] = None


class FinishSessionRequest(BaseModel):
    score: int                        # percentage 0-100
    answers: List[AnswerEntry] = Field(default_factory=list)


@router.post("/", response_model=dict)
async def start_session(
    request: StartSessionRequest,
    session: Session = Depends(get_session),
):
    """Start a new attempt for the given quiz."""
    db_service.get_or_create_user(session, request.user_id,
                                   email=f"{request.user_id}@getquiz.app")
    try:
        quiz_id = uuid.UUID(request.quiz_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid quiz_id")

    attempt = db_service.start_attempt(session, request.user_id, quiz_id)
    return {
        "id": str(attempt.id),
        "quiz_id": str(attempt.quiz_id),
        "user_id": attempt.user_id,
        "status": attempt.status,
    }


@router.post("/{attempt_id}/finish", response_model=dict)
async def finish_session(
    attempt_id: uuid.UUID,
    request: FinishSessionRequest,
    session: Session = Depends(get_session),
):
    """Mark an attempt as completed and persist the score."""
    answers = [a.model_dump() for a in request.answers]
    attempt = db_service.complete_attempt(session, attempt_id, request.score, answers)
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    return {
        "id": str(attempt.id),
        "score": attempt.score,
        "status": attempt.status,
    }


@router.get("/", response_model=List[dict])
async def list_sessions(
    user_id: Optional[str] = "anonymous",
    session: Session = Depends(get_session),
):
    """List all completed attempts for a user (newest first)."""
    from sqlmodel import select
    from models.database import Attempt
    rows = session.exec(
        select(Attempt)
        .where(Attempt.user_id == user_id, Attempt.status == "completed")
        .order_by(Attempt.end_time.desc())
    ).all()
    return [
        {
            "id": str(r.id),
            "quiz_id": str(r.quiz_id),
            "score": r.score,
            "end_time": r.end_time.isoformat() if r.end_time else None,
        }
        for r in rows
    ]
