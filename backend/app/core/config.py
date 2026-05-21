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


@lru_cache
def get_settings() -> Settings:
    return Settings()
