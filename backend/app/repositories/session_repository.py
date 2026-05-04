class SessionRepository:
    def __init__(self) -> None:
        self._sessions: dict[str, str] = {}

    def create(self, token: str, user_id: str) -> str:
        self._sessions[token] = user_id
        return token

    def get_user_id(self, token: str) -> str | None:
        return self._sessions.get(token)

    def delete(self, token: str) -> bool:
        removed = self._sessions.pop(token, None)
        return removed is not None

    def clear(self) -> None:
        self._sessions.clear()