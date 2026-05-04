from app.models.user_model import User


class UserRepository:
    def __init__(self) -> None:
        self._users_by_id: dict[str, User] = {}
        self._user_ids_by_email: dict[str, str] = {}

    def create(self, user: User) -> User:
        self._users_by_id[user.id] = user
        self._user_ids_by_email[user.email] = user.id
        return user

    def get_by_id(self, user_id: str) -> User | None:
        return self._users_by_id.get(user_id)

    def get_by_email(self, email: str) -> User | None:
        user_id = self._user_ids_by_email.get(email)
        if user_id is None:
            return None
        return self._users_by_id.get(user_id)

    def clear(self) -> None:
        self._users_by_id.clear()
        self._user_ids_by_email.clear()