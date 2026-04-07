from sqlmodel import Session, select
from models.database import Users, Quizzes, Questions, Options, Attempt, UserAnswerHistory, UserQuotas
from typing import List, Optional
import uuid, json
from datetime import datetime

# ── User helpers ──────────────────────────────────────────────────────────────

def get_or_create_user(session: Session, user_id: str, email: str) -> Users:
    user = session.get(Users, user_id)
    if not user:
        user = Users(id=user_id, email=email)
        session.add(user)
        quota = UserQuotas(user_id=user_id, quota_remaining=50)
        session.add(quota)
        session.commit()
        session.refresh(user)
    return user

# ── Quiz persistence helpers ──────────────────────────────────────────────────

def _save_questions(session: Session, quiz_id: uuid.UUID, questions: list):
    """Shared helper: persists a list of normalised question dicts."""
    for q_data in questions:
        q_type = q_data.get("type", "mcq")
        options_list = q_data.get("options", [])

        # Normalise T/F: frontend stores 'correct: bool' without options list
        if q_type == "tf" and not options_list:
            options_list = ["True", "False"]
            q_data["correctIndex"] = 0 if q_data.get("correct", True) else 1

        question = Questions(
            quiz_id=quiz_id,
            content=q_data.get("text"),
            explanation=q_data.get("explanation"),
            type=q_type,
        )
        session.add(question)
        session.flush()

        for idx, opt_text in enumerate(options_list):
            is_correct = (idx == q_data.get("correctIndex", 0))
            session.add(Options(
                question_id=question.id,
                content=opt_text,
                is_correct=is_correct,
            ))


def save_generated_quiz(session: Session, user_id: str, quiz_data: dict) -> Quizzes:
    """Save an AI-generated quiz (title, description, tags, questions all from AI output)."""
    tags_raw = quiz_data.get("tags", [])
    new_quiz = Quizzes(
        user_id=user_id,
        title=quiz_data.get("title", "Untitled Quiz"),
        description=quiz_data.get("description", ""),
        tags=json.dumps(tags_raw if isinstance(tags_raw, list) else []),
        difficulty=quiz_data.get("difficulty", "easy"),
    )
    session.add(new_quiz)
    session.flush()
    _save_questions(session, new_quiz.id, quiz_data.get("questions", []))
    session.commit()
    session.refresh(new_quiz)
    return new_quiz


def save_manual_quiz(session: Session, user_id: str, quiz_data: dict) -> Quizzes:
    """Save a manually created quiz from the Create Quiz form."""
    tags_raw = quiz_data.get("tags", [])
    new_quiz = Quizzes(
        user_id=user_id,
        title=quiz_data.get("title", "Untitled Quiz"),
        description=quiz_data.get("description", ""),
        tags=json.dumps(tags_raw if isinstance(tags_raw, list) else []),
        difficulty=quiz_data.get("difficulty", "easy"),
    )
    session.add(new_quiz)
    session.flush()
    _save_questions(session, new_quiz.id, quiz_data.get("questions", []))
    session.commit()
    session.refresh(new_quiz)
    return new_quiz


# ── Quiz queries ──────────────────────────────────────────────────────────────

def list_user_quizzes(session: Session, user_id: str) -> List[Quizzes]:
    stmt = select(Quizzes).where(Quizzes.user_id == user_id).order_by(Quizzes.created_time.desc())
    return session.exec(stmt).all()


def get_quiz_by_id(session: Session, quiz_id: uuid.UUID) -> Optional[Quizzes]:
    return session.get(Quizzes, quiz_id)


def delete_quiz(session: Session, quiz_id: uuid.UUID, user_id: str) -> bool:
    quiz = session.get(Quizzes, quiz_id)
    if not quiz or quiz.user_id != user_id:
        return False
    session.delete(quiz)
    session.commit()
    return True


# ── Attempt helpers ───────────────────────────────────────────────────────────

def start_attempt(session: Session, user_id: str, quiz_id: uuid.UUID) -> Attempt:
    attempt = Attempt(user_id=user_id, quiz_id=quiz_id)
    session.add(attempt)
    session.commit()
    session.refresh(attempt)
    return attempt


def complete_attempt(session: Session, attempt_id: uuid.UUID, score: int, answers: List[dict]) -> Attempt:
    attempt = session.get(Attempt, attempt_id)
    if not attempt:
        return None
    attempt.score = score
    attempt.status = "completed"
    attempt.end_time = datetime.utcnow()
    for ans in answers:
        session.add(UserAnswerHistory(
            attempt_id=attempt_id,
            question_id=ans.get("question_id"),
            option_id=ans.get("option_id"),
        ))
    session.commit()
    session.refresh(attempt)
    return attempt
