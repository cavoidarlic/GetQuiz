from fastapi import APIRouter, HTTPException, Depends, Form, File, UploadFile
from models.schemas import APIResponse, GeneratedQuizResponse, SaveManualQuizRequest
from services.ai_service import generate_quiz_from_prompt
from services import db_service, file_service
from models.database import get_session
from sqlmodel import Session
from typing import List, Optional
import uuid, json

router = APIRouter(prefix="/quizzes", tags=["Quizzes"])

# ── Helper: convert a DB Quizzes row → frontend-friendly dict ─────────────────

def _quiz_to_response(quiz, include_questions: bool = False, stats: dict = None) -> dict:
    tags = json.loads(quiz.tags) if quiz.tags else []
    questions = []
    if include_questions:
        for q in quiz.questions:
            questions.append({
                "id": q.id,
                "type": q.type,
                "text": q.content,
                "explanation": q.explanation,
                "options": [o.content for o in q.options],
                "optionIds": [o.id for o in q.options],
                "correctIndex": next((i for i, o in enumerate(q.options) if o.is_correct), 0),
                "correct": None if q.type != "tf" else next(
                    (o.is_correct for o in q.options if o.content == "True"), None
                ),
            })
    s = stats or {}
    return {
        "id": str(quiz.id),
        "title": quiz.title,
        "description": quiz.description or "",
        "tags": tags,
        "difficulty": quiz.difficulty,
        "createdAt": quiz.created_time.strftime("%Y-%m-%d"),
        "questionCount": len(quiz.questions),
        "questions": questions,
        # attempt stats (0 / None when no attempts yet)
        "attemptCount": s.get("attemptCount", 0),
        "bestScore": s.get("bestScore"),
        "lastAttempted": s.get("lastAttempted"),
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/", response_model=List[dict])
async def list_quizzes(
    user_id: Optional[str] = "anonymous",
    is_deleted: bool = False,
    session: Session = Depends(get_session),
):
    # description: Lấy danh sách quiz theo trạng thái xóa mềm
    # input: user_id, is_deleted (mặc định False)
    # output: Danh sách dict chứa thông tin quizzes
    quizzes = db_service.list_user_quizzes(session, user_id, is_deleted)
    stats_map = db_service.get_attempt_stats(session, user_id)
    return [_quiz_to_response(q, include_questions=True, stats=stats_map.get(str(q.id))) for q in quizzes]


@router.get("/{quiz_id}", response_model=dict)
async def get_quiz(quiz_id: uuid.UUID, session: Session = Depends(get_session)):
    """Get full quiz details including all questions and options."""
    quiz = db_service.get_quiz_by_id(session, quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return _quiz_to_response(quiz, include_questions=True)


@router.post("/generate", response_model=APIResponse)
async def generate_quiz(
    user_id: str = Form(default="anonymous"),
    topic: str = Form(...),
    count: int = Form(default=5),
    file: Optional[UploadFile] = File(default=None),
    session: Session = Depends(get_session),
):
    """Generate an AI quiz and persist it to the database.
    
    Accepts multipart/form-data. An optional file (.txt, .pdf, .docx) can be
    attached to provide document context for the AI quiz generation.
    """
    if not topic or len(topic.strip()) < 3:
        raise HTTPException(status_code=400, detail="Topic is too short or empty.")

    db_service.get_or_create_user(
        session, user_id, email=f"{user_id}@getquiz.app"
    )

    # Extract text from uploaded file (if any)
    context = ""
    if file and file.filename:
        try:
            context = await file_service.extract_text_from_file(file)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to process file: {str(e)}")

    ai_response = await generate_quiz_from_prompt(topic, count, context=context)
    if ai_response.get("status") == "error":
        raise HTTPException(
            status_code=400,
            detail=ai_response.get("message", "AI refused to process this topic."),
        )

    try:
        quiz_data = ai_response.get("data")
        db_quiz = db_service.save_generated_quiz(session, user_id, quiz_data)
        resp = _quiz_to_response(db_quiz, include_questions=True)
        return APIResponse(status="success", data=resp)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving quiz to database: {str(e)}")


@router.post("/", response_model=dict)
async def save_manual_quiz(
    request: SaveManualQuizRequest,
    session: Session = Depends(get_session),
):
    """Save a manually created quiz (from the Create Quiz form)."""
    db_service.get_or_create_user(
        session, request.user_id, email=f"{request.user_id}@getquiz.app"
    )
    try:
        quiz_data = request.model_dump()
        db_quiz = db_service.save_manual_quiz(session, request.user_id, quiz_data)
        return _quiz_to_response(db_quiz, include_questions=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving quiz: {str(e)}")


@router.delete("/{quiz_id}")
async def delete_quiz(
    quiz_id: uuid.UUID,
    user_id: Optional[str] = "anonymous",
    session: Session = Depends(get_session),
):
    # description: Xóa mềm một quiz
    # input: quiz_id, user_id
    # output: Trạng thái deleted và id của quiz
    deleted = db_service.delete_quiz(session, quiz_id, user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Quiz not found or access denied")
    return {"status": "deleted", "id": str(quiz_id)}


@router.patch("/{quiz_id}/restore")
async def restore_quiz(
    quiz_id: uuid.UUID,
    user_id: Optional[str] = "anonymous",
    session: Session = Depends(get_session),
):
    # description: Khôi phục một quiz đã bị xóa mềm
    # input: quiz_id, user_id
    # output: Trạng thái restored và id của quiz
    restored = db_service.restore_quiz(session, quiz_id, user_id)
    if not restored:
        raise HTTPException(status_code=404, detail="Quiz not found or access denied")
    return {"status": "restored", "id": str(quiz_id)}


@router.delete("/{quiz_id}/permanent")
async def permanent_delete_quiz(
    quiz_id: uuid.UUID,
    user_id: Optional[str] = "anonymous",
    session: Session = Depends(get_session),
):
    # description: Xóa vĩnh viễn một quiz khỏi CSDL
    # input: quiz_id, user_id
    # output: Trạng thái permanently_deleted và id
    deleted = db_service.permanent_delete_quiz(session, quiz_id, user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Quiz not found or access denied")
    return {"status": "permanently_deleted", "id": str(quiz_id)}
