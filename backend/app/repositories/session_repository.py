from sqlalchemy import delete, select

from app.database import session_scope
from app.models.user_model import SessionToken


class SessionRepository:
    def create(self, token: str, user_id: str) -> str:
        with session_scope() as session:
            session.add(SessionToken(token=token, user_id=user_id))
            return token

    def get_user_id(self, token: str) -> str | None:
        with session_scope() as session:
            return session.scalar(
                select(SessionToken.user_id).where(SessionToken.token == token)
            )

    def delete(self, token: str) -> bool:
        with session_scope() as session:
            existing = session.get(SessionToken, token)
            if existing is None:
                return False
            session.delete(existing)
            return True

    def clear(self) -> None:
        with session_scope() as session:
            session.execute(delete(SessionToken))
