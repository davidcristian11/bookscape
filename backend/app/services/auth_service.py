import hashlib
import secrets
from uuid import uuid4

from app.models.user_model import User
from app.repositories.session_repository import SessionRepository
from app.repositories.user_repository import UserRepository
from app.schemas.auth import AuthResponse, LoginRequest, RegisterRequest, UserResponse
from app.services.logging_service import LoggingService


class AuthService:
    def __init__(
        self,
        user_repository: UserRepository,
        session_repository: SessionRepository,
        logging_service: LoggingService | None = None,
    ) -> None:
        self.user_repository = user_repository
        self.session_repository = session_repository
        self.logging_service = logging_service

    def _hash_password(self, password: str) -> str:
        return hashlib.sha256(password.encode("utf-8")).hexdigest()

    def _to_user_response(self, user: User) -> UserResponse:
        roles = sorted(role.name for role in user.roles)
        permissions = sorted(
            {
                permission.name
                for role in user.roles
                for permission in role.permissions
            }
        )
        role = "admin" if "admin" in roles else (roles[0] if roles else "user")

        return UserResponse(
            id=user.id,
            name=user.name,
            email=user.email,
            role=role,
            roles=roles,
            permissions=permissions,
            is_admin="admin" in roles,
        )

    def _role_name(self, user: User | None) -> str:
        if user is None:
            return "anonymous"
        roles = {role.name for role in user.roles}
        if "admin" in roles:
            return "admin"
        return next(iter(sorted(roles)), "user")

    def _log(self, user: User | None, action: str, details: str = "") -> None:
        if self.logging_service is None:
            return
        self.logging_service.log_action(
            user_id=user.id if user else None,
            role_name=self._role_name(user),
            action=action,
            details=details,
        )

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

        user = self.user_repository.create(user, role_name="user")

        token = secrets.token_hex(24)
        self.session_repository.create(token, user.id)
        self._log(user, "register", f"Registered {user.email}")

        return AuthResponse(
            token=token,
            user=self._to_user_response(user),
        )

    def login(self, payload: LoginRequest) -> AuthResponse:
        user = self.user_repository.get_by_email(payload.email)
        if user is None:
            self._log(None, "failed_login", f"Unknown email {payload.email}")
            raise ValueError("Invalid email or password")

        password_hash = self._hash_password(payload.password)
        if user.password_hash != password_hash:
            self._log(user, "failed_login", f"Failed login for {payload.email}")
            raise ValueError("Invalid email or password")

        token = secrets.token_hex(24)
        self.session_repository.create(token, user.id)
        self._log(user, "login", f"Logged in {payload.email}")

        return AuthResponse(
            token=token,
            user=self._to_user_response(user),
        )

    def get_current_user(self, token: str) -> UserResponse | None:
        user_id = self.session_repository.get_user_id(token)
        if user_id is None:
            return None

        user = self.user_repository.get_by_id(user_id)
        if user is None:
            return None

        return self._to_user_response(user)

    def logout(self, token: str) -> bool:
        user_id = self.session_repository.get_user_id(token)
        user = self.user_repository.get_by_id(user_id) if user_id else None
        deleted = self.session_repository.delete(token)
        if deleted:
            self._log(user, "logout", "Logged out")
        return deleted
