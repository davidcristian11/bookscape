from datetime import datetime, timedelta, timezone

from app.repositories.activity_repository import ActivityRepository
from app.schemas.admin import LogEntryResponse, ObservationListEntryResponse


class LoggingService:
    def __init__(self, repository: ActivityRepository) -> None:
        self.repository = repository

    def _now(self) -> datetime:
        return datetime.now(timezone.utc)

    def _map_log(self, entry) -> LogEntryResponse:
        return LogEntryResponse(
            id=entry.id,
            user_id=entry.user_id,
            user_email=entry.user.email if entry.user else None,
            role_name=entry.role_name,
            action=entry.action,
            details=entry.details,
            timestamp=entry.timestamp,
        )

    def _map_observation(self, entry) -> ObservationListEntryResponse:
        return ObservationListEntryResponse(
            id=entry.id,
            user_id=entry.user_id,
            user_email=entry.user.email if entry.user else None,
            user_name=entry.user.name if entry.user else None,
            role_name=entry.role_name,
            reason=entry.reason,
            score=entry.score,
            last_action_at=entry.last_action_at,
            created_at=entry.created_at,
            updated_at=entry.updated_at,
        )

    def log_action(
        self,
        *,
        user_id: str | None,
        role_name: str = "anonymous",
        action: str,
        details: str = "",
    ) -> None:
        timestamp = self._now()
        self.repository.create_log(
            user_id=user_id,
            role_name=role_name or "unknown",
            action=action,
            details=details[:2000],
            timestamp=timestamp,
        )

        if user_id is not None:
            self._detect_suspicious_activity(user_id, role_name or "unknown", timestamp)

    def _detect_suspicious_activity(
        self,
        user_id: str,
        role_name: str,
        timestamp: datetime,
    ) -> None:
        rules = [
            (
                {"delete_book", "delete_quote_card"},
                timedelta(minutes=10),
                3,
                "High volume of delete actions in a short time",
            ),
            (
                {"failed_login"},
                timedelta(minutes=10),
                3,
                "Repeated failed login attempts",
            ),
            (
                {"forbidden_action"},
                timedelta(minutes=10),
                2,
                "Repeated restricted action attempts",
            ),
            (
                {"chat_message"},
                timedelta(minutes=1),
                10,
                "Possible chat spam",
            ),
        ]

        for actions, window, threshold, reason in rules:
            count = self.repository.count_recent_actions(
                user_id=user_id,
                actions=actions,
                since=timestamp - window,
            )
            if count >= threshold:
                self.repository.upsert_observation(
                    user_id=user_id,
                    role_name=role_name,
                    reason=reason,
                    score=count,
                    last_action_at=timestamp,
                )

    def list_logs(self, limit: int = 100) -> list[LogEntryResponse]:
        return [self._map_log(entry) for entry in self.repository.list_logs(limit)]

    def list_observations(self) -> list[ObservationListEntryResponse]:
        return [self._map_observation(entry) for entry in self.repository.list_observations()]
