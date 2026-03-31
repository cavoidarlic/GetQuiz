from pydantic import BaseModel, Field
from typing import List, Optional

# --- REQUEST PAYLOAD FROM FRONTEND ---
class GenerateQuizRequest(BaseModel):
    topic: str = Field(..., description="The quiz topic requested by the user")
    count: int = Field(default=5, ge=1, le=20, description="Number of questions (max 20)")

# --- RESPONSE STRUCTURE (GEMINI MUST RETURN THIS EXACT FORMAT) ---
class Question(BaseModel):
    id: int
    type: str = Field(..., description="'mcq' for multiple-choice or 'tf' for true/false")
    text: str = Field(..., description="The question text")
    options: List[str] = Field(..., description="List of options as strings. For 'tf', it must be exactly ['True', 'False']")
    correctIndex: int = Field(default=0, description="The index of the correct answer in the options array")
    
    # Used for Frontend True/False interactions
    correct: Optional[bool] = Field(default=None, description="Only for 'tf' type, marks whether the statement is true or false")

class GeneratedQuizResponse(BaseModel):
    id: Optional[int] = None
    createdAt: Optional[str] = None
    questionCount: Optional[int] = None
    title: str
    description: str
    tags: List[str]
    questions: List[Question]

class APIResponse(BaseModel):
    status: str = Field(..., description="'success' or 'error'")
    message: Optional[str] = None
    data: Optional[GeneratedQuizResponse] = None
