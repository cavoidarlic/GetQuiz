from fastapi import APIRouter, Depends
from typing import List, Optional
from sqlmodel import Session
from models.database import get_session
from services import db_service

router = APIRouter(prefix="/history", tags=["History"])


@router.get("/", response_model=List[dict])
async def get_activity_log(
    user_id: Optional[str] = "anonymous",
    session: Session = Depends(get_session),
):
    """Return the full activity log for a user (created, attempted, deleted), newest first."""
    return db_service.get_user_activity_log(session, user_id)
