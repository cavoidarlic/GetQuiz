from pydantic import BaseModel, Field
from typing import List, Optional

# ── Requests ──────────────────────────────────────────────────────────────────

class GenerateQuizRequest(BaseModel):
    # user_id populated by Clerk JWT later; defaults to 'anonymous' until auth is integrated
    user_id: str = Field(default="anonymous", description="Clerk User ID")
    topic: str = Field(..., description="The quiz topic requested by the user")
    count: int = Field(default=5, ge=1, le=20, description="Number of questions (1-20)")

class ManualQuizQuestion(BaseModel):
    """One question from the manual Create Quiz form."""
    type: str = Field(..., description="'mcq' or 'tf'")
    text: str = Field(..., description="Question text / statement")
    options: Optional[List[str]] = Field(default=None, description="MCQ option strings")
    correctIndex: Optional[int] = Field(default=0, description="Index of correct MCQ option")
    correct: Optional[bool] = Field(default=None, description="T/F correct answer")
    explanation: Optional[str] = None

class SaveManualQuizRequest(BaseModel):
    """Payload sent when the user saves a manually created quiz."""
    user_id: str = Field(default="anonymous")
    title: str
    description: str = ""
    tags: List[str] = []
    difficulty: str = "easy"
    questions: List[ManualQuizQuestion]

# ── AI response structure (Gemini must return this exact format) ───────────────

class AIQuestion(BaseModel):
    id: int
    type: str = Field(..., description="'mcq' or 'tf'")
    text: str
    options: List[str]
    correctIndex: int = 0
    correct: Optional[bool] = None  # T/F only

class GeneratedQuizResponse(BaseModel):
    id: Optional[str] = None
    createdAt: Optional[str] = None
    questionCount: Optional[int] = None
    title: str
    description: str = ""
    tags: List[str] = []
    questions: List       # flexible – AI or DB questions
    difficulty: Optional[str] = "easy"

class APIResponse(BaseModel):
    status: str = Field(..., description="'success' or 'error'")
    message: Optional[str] = None
    data: Optional[GeneratedQuizResponse] = None
