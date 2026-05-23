from __future__ import annotations

from sqlmodel import SQLModel, Field, Relationship, create_engine, Session
from typing import Optional, List
from datetime import datetime
import uuid
import enum
import os
from sqlalchemy import Column, Enum as SAEnum, Text, String
from dotenv import load_dotenv

load_dotenv()

# Database Setup
DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

SQLITE_FALLBACK_URL = "sqlite:///./getquiz.db"

_engine = None

def get_engine():
    global _engine
    if _engine is not None:
        return _engine

    database_url = DATABASE_URL or SQLITE_FALLBACK_URL
    try:
        if database_url.startswith("sqlite"):
            _engine = create_engine(database_url, connect_args={"check_same_thread": False})
        else:
            _engine = create_engine(database_url)
    except Exception:
        try:
            _engine = create_engine(SQLITE_FALLBACK_URL, connect_args={"check_same_thread": False})
        except Exception:
            _engine = None
    return _engine

def create_db_and_tables():
    engine = get_engine()
    if engine:
        SQLModel.metadata.create_all(engine)

def get_session():
    engine = get_engine()
    if engine is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail="Database engine could not be initialized.")
    with Session(engine) as session:
        yield session


# --- MODELS ---

class Users(SQLModel, table=True):
    __tablename__ = "users"
    id: str = Field(primary_key=True, description="Clerk User ID")
    email: Optional[str] = Field(default=None, max_length=255, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    user_quota: Optional["UserQuotas"] = Relationship(back_populates="user", sa_relationship_kwargs={"uselist": False})
    attempts: List["Attempt"] = Relationship(back_populates="user")
    quizzes: List["Quizzes"] = Relationship(back_populates="user")


class UserQuotas(SQLModel, table=True):
    __tablename__ = "user_quotas"
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: str = Field(foreign_key="users.id", index=True)
    quota_remaining: int = Field(default=50)
    reset_time: Optional[datetime] = Field(default=None)
    
    user: Optional["Users"] = Relationship(back_populates="user_quota")

class QuizDifficulties(str, enum.Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"
    SUPERHARD = "superhard"

class Quizzes(SQLModel, table=True):
    __tablename__ = "quizzes"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: str = Field(foreign_key="users.id", index=True)
    title: str = Field(max_length=255)
    description: Optional[str] = Field(sa_column=Column(Text, server_default=""))
    tags: Optional[str] = Field(sa_column=Column(Text, server_default="[]"))
    difficulty: QuizDifficulties = Field(
        sa_column=Column(SAEnum(QuizDifficulties), default=QuizDifficulties.EASY)
    )
    created_time: datetime = Field(default_factory=datetime.utcnow)
    
    is_deleted: bool = Field(default=False)
    
    user: Optional["Users"] = Relationship(back_populates="quizzes")
    questions: List["Questions"] = Relationship(back_populates="quiz", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    attempts: List["Attempt"] = Relationship(back_populates="quiz")


class Questions(SQLModel, table=True):
    __tablename__ = "questions"
    id: Optional[int] = Field(default=None, primary_key=True)
    quiz_id: uuid.UUID = Field(foreign_key="quizzes.id", index=True)
    content: str = Field(sa_column=Column(Text))
    explanation: Optional[str] = Field(sa_column=Column(Text))
    type: str = Field(sa_column=Column(Text, server_default="mcq"))


    quiz: Optional["Quizzes"] = Relationship(back_populates="questions")
    options: List["Options"] = Relationship(back_populates="question", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    answers_history: List["UserAnswersHistory"] = Relationship(back_populates="question")

class Options(SQLModel, table=True):
    __tablename__ = "options"
    id: Optional[int] = Field(default=None, primary_key=True)
    question_id: int = Field(foreign_key="questions.id", index=True)
    content: str = Field(sa_column=Column(Text))
    is_correct: bool = Field(default=False)
    
    question: Optional["Questions"] = Relationship(back_populates="options")
    user_answers: List["UserAnswersHistory"] = Relationship(back_populates="option")

class AttemptStatus(str, enum.Enum):
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    ABANDONED = "abandoned"

class Attempt(SQLModel, table=True):
    __tablename__ = "attempts"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: str = Field(foreign_key="users.id", index=True)
    quiz_id: uuid.UUID = Field(foreign_key="quizzes.id", index=True)
    score: Optional[int] = Field(default=None)
    starting_time: datetime = Field(default_factory=datetime.utcnow)
    end_time: Optional[datetime] = Field(default=None)
    status: AttemptStatus = Field(
        sa_column=Column(SAEnum(AttemptStatus), default=AttemptStatus.IN_PROGRESS)
    )

    user: Optional["Users"] = Relationship(back_populates="attempts")
    quiz: Optional["Quizzes"] = Relationship(back_populates="attempts")
    answers_history: List["UserAnswersHistory"] = Relationship(back_populates="attempt")

class UserAnswersHistory(SQLModel, table=True):
    __tablename__ = "user_answers_history"
    id: Optional[int] = Field(default=None, primary_key=True)
    attempt_id: uuid.UUID = Field(foreign_key="attempts.id", index=True)
    question_id: int = Field(foreign_key="questions.id")
    option_id: int = Field(foreign_key="options.id")

    attempt: Optional["Attempt"] = Relationship(back_populates="answers_history")
    question: Optional["Questions"] = Relationship(back_populates="answers_history")
    option: Optional["Options"] = Relationship(back_populates="user_answers")


class ActivityEventType(str, enum.Enum):
    QUIZ_CREATED  = "quiz_created"
    QUIZ_DELETED  = "quiz_deleted"
    QUIZ_ATTEMPTED = "quiz_attempted"


class ActivityLog(SQLModel, table=True):
    __tablename__ = "activity_log"
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: str = Field(foreign_key="users.id", index=True)
    event_type: ActivityEventType = Field(
        sa_column=Column(SAEnum(ActivityEventType), nullable=False)
    )
    quiz_id: Optional[str] = Field(default=None, sa_column=Column(String(36)))
    quiz_title: str = Field(sa_column=Column(Text))
    score: Optional[int] = Field(default=None)
    attempt_id: Optional[str] = Field(default=None, sa_column=Column(String(36)))
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)

