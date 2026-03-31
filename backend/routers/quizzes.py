from fastapi import APIRouter, HTTPException
from models.schemas import GenerateQuizRequest, APIResponse
from services.ai_service import generate_quiz_from_prompt
from datetime import datetime

router = APIRouter(
    prefix="/quizzes",
    tags=["Quizzes"],
)

@router.post("/generate", response_model=APIResponse)
async def generate_quiz(request: GenerateQuizRequest):
    """
    API endpoint that receives a prompt from the frontend and returns an AI-generated Quiz.
    """
    if not request.topic or len(request.topic.strip()) < 3:
         raise HTTPException(status_code=400, detail="Topic is too short or empty.")
         
    # Call AI to generate JSON format
    ai_response = await generate_quiz_from_prompt(request.topic, request.count)
    
    if ai_response.get("status") == "error":
        raise HTTPException(status_code=400, detail=ai_response.get("message", "AI refused to process this topic."))
        
    try:
        data = ai_response.get("data")
        # Attach some necessary dynamic fields for the Frontend
        data["id"] = int(datetime.utcnow().timestamp())
        data["createdAt"] = datetime.utcnow().strftime("%Y-%m-%d")
        data["questionCount"] = len(data.get("questions", []))
        
        # AI returns a strict string array format for options, so no need to map.
        return APIResponse(status="success", data=data)
    except Exception as e:
         raise HTTPException(status_code=500, detail=f"Error parsing JSON data from AI: {str(e)}")
