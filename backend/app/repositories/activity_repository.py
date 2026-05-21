from datetime import datetime
from uuid import uuid4

from sqlalchemy import delete, func, select
from sqlalchemy.orm import selectinload

from app.database import session_scope
from app.models.activity_model import LogEntry, ObservationListEntry


class ActivityRepository:
    def create_log(
        self,
        *,
        user_id: str | None,
        role_name: str,
        action: str,
        details: str = "",
        timestamp: datetime,
    ) -> LogEntry:
        with session_scope() as session:
            entry = LogEntry(
                id=str(uuid4()),
                user_id=user_id,
                role_name=role_name,
                action=action,
                details=details,
                timestamp=timestamp,
            )
            session.add(entry)
            session.flush()
            session.refresh(entry)
            return entry

    def count_recent_actions(
        self,
        *,
        user_id: str,
        actions: set[str],
        since: datetime,
    ) -> int:
        with session_scope() as session:
            return session.scalar(
                select(func.count())
                .select_from(LogEntry)
                .where(
                    LogEntry.user_id == user_id,
                    LogEntry.action.in_(actions),
                    LogEntry.timestamp >= since,
                )
            ) or 0

    def upsert_observation(
        self,
        *,
        user_id: str,
        role_name: str,
        reason: str,
        score: int,
        last_action_at: datetime,
    ) -> ObservationListEntry:
        with session_scope() as session:
            entry = session.scalar(
                select(ObservationListEntry).where(ObservationListEntry.user_id == user_id)
            )
            if entry is None:
                entry = ObservationListEntry(
                    id=str(uuid4()),
                    user_id=user_id,
                    role_name=role_name,
                    reason=reason,
                    score=score,
                    last_action_at=last_action_at,
                    updated_at=last_action_at,
                )
                session.add(entry)
            else:
                entry.role_name = role_name
                entry.reason = reason
                entry.score = max(entry.score, score)
                entry.last_action_at = last_action_at
                entry.updated_at = last_action_at

            session.flush()
            session.refresh(entry)
            return entry

    def list_observations(self) -> list[ObservationListEntry]:
        with session_scope() as session:
            return list(
                session.scalars(
                    select(ObservationListEntry)
                    .options(selectinload(ObservationListEntry.user))
                    .order_by(ObservationListEntry.updated_at.desc())
                ).all()
            )

    def list_logs(self, limit: int = 100) -> list[LogEntry]:
        with session_scope() as session:
            return list(
                session.scalars(
                    select(LogEntry)
                    .options(selectinload(LogEntry.user))
                    .order_by(LogEntry.timestamp.desc())
                    .limit(limit)
                ).all()
            )

    def clear(self) -> None:
        with session_scope() as session:
            session.execute(delete(ObservationListEntry))
            session.execute(delete(LogEntry))
