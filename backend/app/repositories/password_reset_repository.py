from datetime import datetime

from sqlalchemy import delete, select

from app.database import session_scope
from app.models.user_model import PasswordResetToken


class PasswordResetRepository:
    def create(self, token: PasswordResetToken) -> PasswordResetToken:
        with session_scope() as session:
            session.add(token)
            session.flush()
            session.refresh(token)
            return token

    def get_by_hash(self, token_hash: str) -> PasswordResetToken | None:
        with session_scope() as session:
            return session.scalar(
                select(PasswordResetToken).where(PasswordResetToken.token_hash == token_hash)
            )

    def mark_used(self, token_id: str, *, used_at: datetime) -> bool:
        with session_scope() as session:
            existing = session.get(PasswordResetToken, token_id)
            if existing is None or existing.used_at is not None:
                return False
            existing.used_at = used_at
            return True

    def force_expire(self, token_hash: str, *, expires_at: datetime) -> bool:
        with session_scope() as session:
            existing = session.scalar(
                select(PasswordResetToken).where(PasswordResetToken.token_hash == token_hash)
            )
            if existing is None:
                return False
            existing.expires_at = expires_at
            return True

    def clear(self) -> None:
        with session_scope() as session:
            session.execute(delete(PasswordResetToken))
