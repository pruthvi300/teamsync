"""Settings loaded from environment variables and `.env`."""

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

INSECURE_DEFAULT_SECRET = "change-me-to-a-random-64-char-string"


class Settings(BaseSettings):
    # extra="ignore": the shared .env also holds POSTGRES_* values for docker-compose.
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=True, extra="ignore")

    APP_NAME: str = "TeamSync"
    ENVIRONMENT: str = "development"  # development | test | production
    DEBUG: bool = False

    DATABASE_URL: str = "postgresql+asyncpg://teamsync:teamsync_secret@localhost:5432/teamsync_db"
    # Used by Socket.IO to broadcast across several API instances. Empty = single instance.
    REDIS_URL: str = "redis://localhost:6379/0"

    SECRET_KEY: str = INSECURE_DEFAULT_SECRET
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    BCRYPT_ROUNDS: int = 12

    FRONTEND_URL: str = "http://localhost:5173"

    @model_validator(mode="after")
    def _require_real_secret_in_production(self) -> "Settings":
        if self.ENVIRONMENT == "production" and (
            self.SECRET_KEY == INSECURE_DEFAULT_SECRET or len(self.SECRET_KEY) < 32
        ):
            raise ValueError("Set SECRET_KEY to a random value of at least 32 characters in production")
        return self

    @property
    def cors_origins(self) -> list[str]:
        return sorted({self.FRONTEND_URL, "http://localhost:5173"})


settings = Settings()
