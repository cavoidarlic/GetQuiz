import json
import google.generativeai as genai
from core.config import settings
from models.schemas import GeneratedQuizResponse

# Configure API Key for Google Generative AI
genai.configure(api_key=settings.GEMINI_API_KEY)

# Use the standard model widely supported across regions:
model = genai.GenerativeModel('gemini-2.5-flash')

async def generate_quiz_from_prompt(topic: str, count: int) -> dict:
    """
    Send prompt to Gemini to generate a Quiz in an exact JSON structure.
    Returns a dict to let the Router map it using Pydantic.
    """
    system_instruction = f"""
    You are an AI assistant for the GetQuiz system - a professional Quiz designer expert.
    
    REQUIREMENTS:
    1. The topic provided by the user is: "{topic}".
    2. If this topic is COMPLETELY INAPPROPRIATE, explicit, violates ethical guidelines, or is just random gibberish that cannot form questions, you MUST return ONLY the following JSON error string (without any other text):
       {{"status": "error", "message": "Topic is inappropriate or unclear."}}
       
    3. If the topic is valid, precisely create {count} varied questions (including MCQ - 4 multiple choice options, and TF - True/False options).
    4. TF (True/False) questions MUST have a `correct` boolean attribute indicating the correctness of the statement, AS WELL AS an `options` array containing EXACTLY ["True", "False"], and the corresponding `correctIndex`.
    5. You MUST return ONLY valid JSON matching the exact schema below. Do not use Markdown formatting (do not include ```json and ``` at the edges) and do not explain anything:
    {{
      "status": "success",
      "data": {{
        "title": "(An auto-generated Quiz Title based on the topic)",
        "description": "(A short description under 20 words)",
        "tags": ["(tag 1)", "(tag 2)", "(tag 3)"],
        "questions": [
          {{
            "id": 1,
            "type": "mcq",
            "text": "(Multiple Choice Question Text?)",
            "options": ["A", "B", "C", "D"],
            "correctIndex": 0
          }},
          {{
            "id": 2,
            "type": "tf",
            "text": "(A True or False statement evaluation.)",
            "options": ["True", "False"],
            "correctIndex": 0,
            "correct": true
          }}
        ]
      }}
    }}
    """

    try:
        response = model.generate_content(system_instruction)
        response_text = response.text.strip()
        
        # Falsesafe in case Gemini includes markdown tags anyway
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
            
        return json.loads(response_text)
    except Exception as e:
        return {"status": "error", "message": f"Gemini Error: {str(e)}"}
