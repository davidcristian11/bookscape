import hashlib
import secrets
from uuid import uuid4

from app.models.user_model import User
from app.repositories.session_repository import SessionRepository
from app.repositories.user_repository import UserRepository
from app.schemas.auth import AuthResponse, LoginRequest, RegisterRequest, UserResponse


class AuthService:
    def __init__(
        self,
        user_repository: UserRepository,
        session_repository: SessionRepository,
    ) -> None:
        self.user_repository = user_repository
        self.session_repository = session_repository

    def _hash_password(self, password: str) -> str:
        return hashlib.sha256(password.encode("utf-8")).hexdigest()

    def register(self, payload: RegisterRequest) -> AuthResponse:
        existing_user = self.user_repository.get_by_email(payload.email)
        if existing_user is not None:
            raise ValueError("A user with this email already exists")

        user = User(
            id=str(uuid4()),
            name=payload.name,
            email=payload.email,
            password_hash=self._hash_password(payload.password),
        )

        self.user_repository.create(user)

        token = secrets.token_hex(24)
        self.session_repository.create(token, user.id)

        return AuthResponse(
            token=token,
            user=UserResponse.model_validate(user),
        )

    def login(self, payload: LoginRequest) -> AuthResponse:
        user = self.user_repository.get_by_email(payload.email)
        if user is None:
            raise ValueError("Invalid email or password")

        password_hash = self._hash_password(payload.password)
        if user.password_hash != password_hash:
            raise ValueError("Invalid email or password")

        token = secrets.token_hex(24)
        self.session_repository.create(token, user.id)

        return AuthResponse(
            token=token,
            user=UserResponse.model_validate(user),
        )

    def get_current_user(self, token: str) -> UserResponse | None:
        user_id = self.session_repository.get_user_id(token)
        if user_id is None:
            return None

        user = self.user_repository.get_by_id(user_id)
        if user is None:
            return None

        return UserResponse.model_validate(user)

    def logout(self, token: str) -> bool:
        return self.session_repository.delete(token)