from functools import lru_cache
from pathlib import Path
import os

from dotenv import load_dotenv


BACKEND_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BACKEND_DIR / ".env")


class Settings:
    database_url: str
    mongodb_url: str
    mongodb_db: str
    cors_origins: list[str]
    cors_origin_regex: str
    jwt_secret_key: str
    jwt_access_token_minutes: int
    session_lifetime_days: int
    session_inactivity_minutes: int
    password_reset_minutes: int
    auth_expose_reset_token: bool

    def __init__(self) -> None:
        self.database_url = os.getenv(
            "DATABASE_URL",
            "postgresql+psycopg://bookscape:bookscape_password@localhost:5432/bookscape_db",
        )
        self.mongodb_url = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
        self.mongodb_db = os.getenv("MONGODB_DB", "bookscape_chat")
        self.cors_origins = [
            origin.strip()
            for origin in os.getenv(
                "CORS_ORIGINS",
                "http://localhost:5173,http://127.0.0.1:5173",
            ).split(",")
            if origin.strip()
        ]
        self.cors_origin_regex = os.getenv(
            "CORS_ORIGIN_REGEX",
            r"^https?://((localhost|127\.0\.0\.1)|(\d{1,3}\.){3}\d{1,3})(:\d+)?$",
        )
        self.jwt_secret_key = os.getenv(
            "JWT_SECRET_KEY",
            "bookscape-dev-secret-change-me",
        )
        self.jwt_access_token_minutes = _env_int("JWT_ACCESS_TOKEN_MINUTES", 60)
        self.session_lifetime_days = _env_int("SESSION_LIFETIME_DAYS", 7)
        self.session_inactivity_minutes = _env_int("SESSION_INACTIVITY_MINUTES", 30)
        self.password_reset_minutes = _env_int("PASSWORD_RESET_MINUTES", 30)
        self.auth_expose_reset_token = _env_bool("AUTH_EXPOSE_RESET_TOKEN", True)


def _env_int(name: str, default: int) -> int:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default
    try:
        return int(raw_value)
    except ValueError:
        return default


def _env_bool(name: str, default: bool) -> bool:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default
    return raw_value.strip().lower() in {"1", "true", "yes", "on"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
