from sqlmodel import Session, select
from sqlalchemy import func
from sqlalchemy.orm import selectinload
from models.database import (
    Users, Quizzes, Questions, Options,
    Attempt, UserAnswersHistory, UserQuotas,
    ActivityLog, ActivityEventType,
)
from typing import List, Optional, Dict
import uuid, json
from datetime import datetime

# ── User helpers ──────────────────────────────────────────────────────────────

def get_or_create_user(session: Session, user_id: str, email: str = None) -> Users:
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
    """Save an AI-generated quiz and log the creation event."""
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
    _log_event(session, user_id, ActivityEventType.QUIZ_CREATED,
               quiz_id=str(new_quiz.id), quiz_title=new_quiz.title)
    session.commit()
    session.refresh(new_quiz)
    return new_quiz


def save_manual_quiz(session: Session, user_id: str, quiz_data: dict) -> Quizzes:
    """Save a manually created quiz and log the creation event."""
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
    _log_event(session, user_id, ActivityEventType.QUIZ_CREATED,
               quiz_id=str(new_quiz.id), quiz_title=new_quiz.title)
    session.commit()
    session.refresh(new_quiz)
    return new_quiz


# ── Quiz queries ──────────────────────────────────────────────────────────────

def list_user_quizzes(session: Session, user_id: str, is_deleted: bool = False) -> List[Quizzes]:
    # description: Lấy danh sách quiz của người dùng theo trạng thái xóa mềm
    # input: session CSDL, user_id, cờ is_deleted
    # output: danh sách đối tượng Quizzes
    stmt = (
        select(Quizzes)
        .where(Quizzes.user_id == user_id, Quizzes.is_deleted == is_deleted)
        .options(selectinload(Quizzes.questions).selectinload(Questions.options))
        .order_by(Quizzes.created_time.desc())
    )
    return session.exec(stmt).all()


def get_quiz_by_id(session: Session, quiz_id: uuid.UUID) -> Optional[Quizzes]:
    stmt = (
        select(Quizzes)
        .where(Quizzes.id == quiz_id)
        .options(selectinload(Quizzes.questions).selectinload(Questions.options))
    )
    return session.exec(stmt).first()


def delete_quiz(session: Session, quiz_id: uuid.UUID, user_id: str) -> bool:
    # description: Xóa mềm Quiz bằng cách bật cờ is_deleted
    # input: session, quiz_id, user_id
    # output: boolean xác nhận thành công
    quiz = session.get(Quizzes, quiz_id)
    if not quiz or quiz.user_id != user_id:
        return False
    title = quiz.title  # capture before deletion
    
    quiz.is_deleted = True
    session.add(quiz)
    
    _log_event(session, user_id, ActivityEventType.QUIZ_DELETED,
               quiz_id=str(quiz_id), quiz_title=title)
    session.commit()
    return True

def restore_quiz(session: Session, quiz_id: uuid.UUID, user_id: str) -> bool:
    # description: Khôi phục Quiz bằng cách tắt cờ is_deleted
    # input: session, quiz_id, user_id
    # output: boolean xác nhận thành công
    quiz = session.get(Quizzes, quiz_id)
    if not quiz or quiz.user_id != user_id:
        return False
        
    quiz.is_deleted = False
    session.add(quiz)
    session.commit()
    return True

def permanent_delete_quiz(session: Session, quiz_id: uuid.UUID, user_id: str) -> bool:
    # description: Xóa vĩnh viễn Quiz và dữ liệu liên quan khỏi Database
    # input: session, quiz_id, user_id
    # output: boolean xác nhận thành công
    quiz = session.get(Quizzes, quiz_id)
    if not quiz or quiz.user_id != user_id:
        return False
    
    # Clean up associated Attempts and their UserAnswerHistory to prevent DB foreign key errors
    attempts = session.exec(select(Attempt).where(Attempt.quiz_id == quiz_id)).all()
    for attempt in attempts:
        answers = session.exec(select(UserAnswersHistory).where(UserAnswersHistory.attempt_id == attempt.id)).all()
        for ans in answers:
            session.delete(ans)
        session.delete(attempt)
        
    session.delete(quiz)
    session.commit()
    return True


# ── Attempt stats (aggregated per quiz) ──────────────────────────────────────

def get_attempt_stats(session: Session, user_id: str) -> Dict[str, dict]:
    """
    Returns a dict keyed by quiz_id (str) with:
      { attempt_count, best_score, last_attempted }
    Uses a single aggregated query to avoid N+1.
    """
    rows = session.exec(
        select(
            Attempt.quiz_id,
            func.count(Attempt.id).label("attempt_count"),
            func.max(Attempt.score).label("best_score"),
            func.max(Attempt.end_time).label("last_attempted"),
        )
        .where(
            Attempt.user_id == user_id,
            Attempt.status == "completed",
        )
        .group_by(Attempt.quiz_id)
    ).all()

    stats: Dict[str, dict] = {}
    for row in rows:
        stats[str(row.quiz_id)] = {
            "attemptCount": row.attempt_count,
            "bestScore": row.best_score,
            "lastAttempted": row.last_attempted.strftime("%Y-%m-%d") if row.last_attempted else None,
        }
    return stats


# ── Attempt helpers ───────────────────────────────────────────────────────────

def start_attempt(session: Session, user_id: str, quiz_id: uuid.UUID) -> Attempt:
    attempt = Attempt(user_id=user_id, quiz_id=quiz_id)
    session.add(attempt)
    session.commit()
    session.refresh(attempt)
    return attempt


def complete_attempt(
    session: Session,
    attempt_id: uuid.UUID,
    score: int,              # percentage 0-100
    answers: List[dict],     # [{question_id, option_id}]
) -> Optional[Attempt]:
    attempt = session.get(Attempt, attempt_id)
    if not attempt:
        return None
    attempt.score = score
    attempt.status = "completed"
    attempt.end_time = datetime.utcnow()
    for ans in answers:
        if ans.get("option_id"):
            session.add(UserAnswersHistory(
                attempt_id=attempt_id,
                question_id=ans.get("question_id"),
                option_id=ans.get("option_id"),
            ))
    # Log the attempt in activity
    quiz = session.get(Quizzes, attempt.quiz_id)
    if quiz:
        _log_event(
            session, attempt.user_id, ActivityEventType.QUIZ_ATTEMPTED,
            quiz_id=str(attempt.quiz_id), quiz_title=quiz.title,
            score=score, attempt_id=str(attempt_id),
        )
    session.commit()
    session.refresh(attempt)
    return attempt


def get_user_attempts_detailed(session: Session, user_id: str) -> List[dict]:
    # description: Lấy lịch sử làm bài chi tiết bao gồm giải thích (explanation)
    # input: session, user_id
    # output: list các attempt đã format dạng dict
    stmt = (
        select(Attempt)
        .where(Attempt.user_id == user_id, Attempt.status == "completed")
        .options(
            selectinload(Attempt.quiz),
            selectinload(Attempt.answers_history).selectinload(UserAnswersHistory.question).selectinload(Questions.options),
            selectinload(Attempt.answers_history).selectinload(UserAnswersHistory.option)
        )
        .order_by(Attempt.end_time.desc())
    )
    attempts = session.exec(stmt).all()
    
    results = []
    for att in attempts:
        # Build answer details
        answer_details = []
        for history in att.answers_history:
            q = history.question
            chosen_opt = history.option
            correct_opt = next((o for o in q.options if o.is_correct), None)
            
            # description: Lấy và format dữ liệu chi tiết cho từng câu hỏi trong lần thi
            # input: question (q), lựa chọn của user (chosen_opt), lựa chọn đúng (correct_opt)
            # output: object chứa nội dung câu hỏi, giải thích, các options và đáp án của user/đáp án đúng
            answer_details.append({
                "question_id": q.id,
                "question_text": q.content,
                "explanation": q.explanation,
                "options": [o.content for o in q.options],
                "chosen_answer": chosen_opt.content if chosen_opt else None,
                "is_correct": chosen_opt.is_correct if chosen_opt else False,
                "correct_answer": correct_opt.content if correct_opt else None,
            })
            
        results.append({
            "attempt_id": str(att.id),
            "quiz_id": str(att.quiz_id),
            "quiz_title": att.quiz.title if att.quiz else "Deleted Quiz",
            "score": att.score,
            "end_time": att.end_time.strftime("%Y-%m-%dT%H:%M:%S") if att.end_time else None,
            "details": answer_details
        })
    return results


# ── Activity log ──────────────────────────────────────────────────────────────

def _log_event(
    session: Session,
    user_id: str,
    event_type: ActivityEventType,
    quiz_id: str = None,
    quiz_title: str = "",
    score: int = None,
    attempt_id: str = None,
):
    """Internal helper to append a row to the activity log."""
    session.add(ActivityLog(
        user_id=user_id,
        event_type=event_type,
        quiz_id=quiz_id,
        quiz_title=quiz_title,
        score=score,
        attempt_id=attempt_id,
    ))


def get_user_activity_log(session: Session, user_id: str) -> List[dict]:
    """Returns all activity events for a user, newest first."""
    stmt = (
        select(ActivityLog)
        .where(ActivityLog.user_id == user_id)
        .order_by(ActivityLog.created_at.desc())
    )
    rows = session.exec(stmt).all()
    result = []
    for row in rows:
        result.append({
            "id": row.id,
            "type": row.event_type.value,
            "quizId": row.quiz_id,
            "quizTitle": row.quiz_title,
            "score": row.score,
            "attemptId": row.attempt_id,
            "createdAt": row.created_at.strftime("%Y-%m-%dT%H:%M:%S"),
        })
    return result
