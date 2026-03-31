import os
from dotenv import load_dotenv

# Load custom environment variables from .env file
load_dotenv()

class Settings:
    PROJECT_NAME: str = "GetQuiz AI API"
    VERSION: str = "1.0.0"
    
    # Get key from .env file
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    
    # List of allowed domains for Cross-Origin Resource Sharing (CORS)
    CORS_ORIGINS: list = [
        "http://localhost:5173",  # Default Vite React port
        "http://127.0.0.1:5173",
    ]

settings = Settings()
