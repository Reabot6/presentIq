from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    GROQ_API_KEY: str = "placeholder"
    DATABASE_URL: str = "sqlite+aiosqlite:///./presentiq.db"
    APP_ENV: str = "development"
    GROQ_MODEL: str = "llama-3.3-70b-versatile"

    WEIGHT_EYE_CONTACT: float = 0.25
    WEIGHT_POSTURE: float = 0.20
    WEIGHT_GESTURE: float = 0.20
    WEIGHT_SPEECH_PACE: float = 0.20
    WEIGHT_FILLER_WORDS: float = 0.15

    @property
    def CORS_ORIGINS(self):
        return ["http://localhost:5173", "http://localhost:3000"]

    class Config:
        env_file = ".env"


settings = Settings()