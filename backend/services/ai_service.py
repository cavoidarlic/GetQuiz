import json
import httpx
from core.config import settings
from models.schemas import GeneratedQuizResponse

OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_MODEL = "inclusionai/ring-2.6-1t:free" # Change model based on liking (openrouter has many models)

async def generate_quiz_from_prompt(topic: str, count: int, context: str = "") -> dict:
    """
    Send prompt to Gemini to generate a Quiz in an exact JSON structure.
    If `context` is provided (extracted from an uploaded file), the AI will
    generate questions specifically grounded in that document content.
    Returns a dict to let the Router map it using Pydantic.
    """
    # Build the optional context section of the prompt
    context_section = ""
    if context:
        context_section = f"""
    DOCUMENT CONTEXT:
    The user has provided the following document as additional context.
    You MUST base your questions primarily on the content of this document.
    ---
    {context}
    ---
"""

    system_instruction = f"""\
    You are an AI assistant for the GetQuiz system - a professional Quiz designer expert.
    {context_section}
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
            "explanation": "(Detailed explanation of why the answer is correct)",
            "options": ["A", "B", "C", "D"],
            "correctIndex": 0
          }},
          {{
            "id": 2,
            "type": "tf",
            "text": "(A True or False statement evaluation.)",
            "explanation": "(Detailed explanation of why the statement is True or False)",
            "options": ["True", "False"],
            "correctIndex": 0,
            "correct": true
          }}
        ]
      }}
    }}
    """

    payload = {
        "model": OPENROUTER_MODEL,
        "messages": [{"role": "user", "content": system_instruction}]
    }
    headers = {
        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
        "Content-Type": "application/json"
    }
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(OPENROUTER_ENDPOINT, json=payload, headers=headers, timeout=60)
        response.raise_for_status()
        response_text = response.json()["choices"][0]["message"]["content"].strip()

        # Falsesafe in case model includes markdown tags anyway
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]

        return json.loads(response_text)
    except Exception as e:
        return {"status": "error", "message": f"OpenRouter Error: {str(e)}"}


async def suggest_topics_from_context(context: str) -> dict:
    """
    Analyse the extracted document text and return 3-5 quiz-worthy topic suggestions.
    Each topic has a short title (<=5 words) and a one-sentence description (<=20 words).
    Returns: { "status": "success", "topics": [{"title": str, "description": str}] }
          or { "status": "error",   "message": str }
    """
    system_instruction = f"""\
    You are a quiz curriculum analyst for the GetQuiz system.
    A user has uploaded a document. Read the text below and identify between 3 and 5
    distinct topics that would make excellent quiz subjects for a student studying this material.

    DOCUMENT TEXT:
    ---
    {context}
    ---

    REQUIREMENTS:
    1. Choose topics that are genuinely different from one another and are well-supported by the document.
    2. Each topic title must be 5 words or fewer.
    3. Each description must be exactly one sentence and 20 words or fewer.
    4. Return ONLY valid JSON - no markdown, no code fences, no extra text:
    {{
      "status": "success",
      "topics": [
        {{"title": "Short Topic Title", "description": "One clear sentence describing what this topic covers."}},
        {{"title": "Another Topic", "description": "Brief description of this topic."}}
      ]
    }}
    5. If the document text is too short, gibberish, or cannot produce meaningful topics, return:
       {{"status": "error", "message": "Document does not contain enough content to suggest topics."}}
    """

    payload = {
        "model": OPENROUTER_MODEL,
        "messages": [{"role": "user", "content": system_instruction}]
    }
    headers = {
        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
        "Content-Type": "application/json"
    }
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(OPENROUTER_ENDPOINT, json=payload, headers=headers, timeout=60)
        response.raise_for_status()
        response_text = response.json()["choices"][0]["message"]["content"].strip()

        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]

        return json.loads(response_text)
    except Exception as e:
        return {"status": "error", "message": f"OpenRouter Error: {str(e)}"}