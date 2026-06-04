from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select

from app.database import session_scope
from app.models.user_model import SessionToken


class SessionRepository:
    def _aware(self, value: datetime | None) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value

    def create(
        self,
        token: str,
        user_id: str,
        refresh_token_hash: str | None = None,
        *,
        created_at: datetime | None = None,
        expires_at: datetime | None = None,
    ) -> str:
        now = created_at or datetime.now(timezone.utc)
        with session_scope() as session:
            session.add(
                SessionToken(
                    token=token,
                    user_id=user_id,
                    refresh_token_hash=refresh_token_hash,
                    created_at=now,
                    last_activity_at=now,
                    expires_at=expires_at,
                )
            )
            return token

    def get(self, token: str) -> SessionToken | None:
        with session_scope() as session:
            return session.get(SessionToken, token)

    def get_user_id(self, token: str) -> str | None:
        with session_scope() as session:
            return session.scalar(
                select(SessionToken.user_id).where(
                    SessionToken.token == token,
                    SessionToken.revoked_at.is_(None),
                )
            )

    def is_active(
        self,
        session_token: SessionToken,
        *,
        now: datetime,
        inactivity_timeout: timedelta,
    ) -> bool:
        expires_at = self._aware(session_token.expires_at)
        last_activity_at = self._aware(session_token.last_activity_at)
        revoked_at = self._aware(session_token.revoked_at)

        if revoked_at is not None:
            return False
        if expires_at is None or expires_at <= now:
            return False
        if last_activity_at is None or last_activity_at + inactivity_timeout <= now:
            return False
        return True

    def validate(
        self,
        token: str,
        *,
        now: datetime,
        inactivity_timeout: timedelta,
    ) -> SessionToken | None:
        with session_scope() as session:
            existing = session.get(SessionToken, token)
            if existing is None:
                return None
            if not self.is_active(
                existing,
                now=now,
                inactivity_timeout=inactivity_timeout,
            ):
                if existing.revoked_at is None:
                    existing.revoked_at = now
                return None

            existing.last_activity_at = now
            session.flush()
            session.refresh(existing)
            return existing

    def touch(self, token: str, *, now: datetime) -> bool:
        with session_scope() as session:
            existing = session.get(SessionToken, token)
            if existing is None or existing.revoked_at is not None:
                return False
            existing.last_activity_at = now
            return True

    def rotate_refresh_token(
        self,
        token: str,
        *,
        refresh_token_hash: str,
        now: datetime,
    ) -> bool:
        with session_scope() as session:
            existing = session.get(SessionToken, token)
            if existing is None or existing.revoked_at is not None:
                return False
            existing.refresh_token_hash = refresh_token_hash
            existing.last_activity_at = now
            return True

    def revoke(self, token: str, *, revoked_at: datetime | None = None) -> bool:
        with session_scope() as session:
            existing = session.get(SessionToken, token)
            if existing is None:
                return False
            if existing.revoked_at is None:
                existing.revoked_at = revoked_at or datetime.now(timezone.utc)
            return True

    def revoke_all_for_user(
        self,
        user_id: str,
        *,
        revoked_at: datetime | None = None,
    ) -> int:
        now = revoked_at or datetime.now(timezone.utc)
        with session_scope() as session:
            sessions = list(
                session.scalars(
                    select(SessionToken).where(
                        SessionToken.user_id == user_id,
                        SessionToken.revoked_at.is_(None),
                    )
                ).all()
            )
            for existing in sessions:
                existing.revoked_at = now
            return len(sessions)

    def delete(self, token: str) -> bool:
        return self.revoke(token)

    def force_expire(self, token: str, *, expires_at: datetime) -> bool:
        with session_scope() as session:
            existing = session.get(SessionToken, token)
            if existing is None:
                return False
            existing.expires_at = expires_at
            return True

    def force_inactive(self, token: str, *, last_activity_at: datetime) -> bool:
        with session_scope() as session:
            existing = session.get(SessionToken, token)
            if existing is None:
                return False
            existing.last_activity_at = last_activity_at
            return True

    def clear(self) -> None:
        with session_scope() as session:
            session.execute(delete(SessionToken))
