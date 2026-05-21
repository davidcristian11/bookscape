import os
from pathlib import Path


TEST_DIR = Path(__file__).resolve().parents[1] / ".tmp"
TEST_DIR.mkdir(exist_ok=True)
TEST_DB = TEST_DIR / "bookscape_test.sqlite"

os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB.as_posix()}"
os.environ["MONGODB_URL"] = "memory://bookscape"
os.environ["MONGODB_DB"] = "bookscape_chat_test"

from app.database import Base, engine  # noqa: E402
import app.models  # noqa: F401,E402

Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)
