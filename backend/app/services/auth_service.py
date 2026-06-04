import secrets
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from app.core.config import get_settings
from app.core.security import (
    TokenError,
    create_signed_token,
    decode_signed_token,
    hash_password,
    hash_token,
    needs_password_rehash,
    verify_password,
)
from app.models.user_model import PasswordResetToken, SessionToken, User
from app.repositories.password_reset_repository import PasswordResetRepository
from app.repositories.session_repository import SessionRepository
from app.repositories.user_repository import UserRepository
from app.schemas.auth import (
    AuthResponse,
    LoginRequest,
    PasswordResetConfirmRequest,
    PasswordResetRequest,
    PasswordResetResponse,
    RegisterRequest,
    RefreshRequest,
    UserResponse,
)
from app.services.logging_service import LoggingService


class AuthService:
    def __init__(
        self,
        user_repository: UserRepository,
        session_repository: SessionRepository,
        password_reset_repository: PasswordResetRepository,
        logging_service: LoggingService | None = None,
    ) -> None:
        self.user_repository = user_repository
        self.session_repository = session_repository
        self.password_reset_repository = password_reset_repository
        self.logging_service = logging_service
        self.settings = get_settings()

    def _now(self) -> datetime:
        return datetime.now(timezone.utc)

    def _inactivity_timeout(self) -> timedelta:
        return timedelta(minutes=self.settings.session_inactivity_minutes)

    def _make_aware(self, value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value

    def _hash_password(self, password: str) -> str:
        return hash_password(password)

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

    def _create_access_token(
        self,
        user_response: UserResponse,
        *,
        session_id: str,
        now: datetime,
    ) -> tuple[str, datetime]:
        expires_at = now + timedelta(minutes=self.settings.jwt_access_token_minutes)
        payload = {
            "iss": "bookscape",
            "type": "access",
            "sub": user_response.id,
            "sid": session_id,
            "role": user_response.role,
            "roles": user_response.roles,
            "permissions": user_response.permissions,
            "iat": int(now.timestamp()),
            "exp": int(expires_at.timestamp()),
            "jti": secrets.token_urlsafe(12),
        }
        token = create_signed_token(payload, self.settings.jwt_secret_key)
        return token, expires_at

    def _decode_access_token(
        self,
        token: str,
        *,
        verify_exp: bool = True,
    ) -> dict:
        payload = decode_signed_token(
            token,
            self.settings.jwt_secret_key,
            verify_exp=verify_exp,
        )
        if payload.get("type") != "access":
            raise TokenError("Invalid token type")
        if not payload.get("sub") or not payload.get("sid"):
            raise TokenError("Missing token subject")
        return payload

    def _build_auth_response(
        self,
        user: User,
        *,
        session_id: str,
        refresh_token: str,
        now: datetime,
    ) -> AuthResponse:
        user_response = self._to_user_response(user)
        access_token, expires_at = self._create_access_token(
            user_response,
            session_id=session_id,
            now=now,
        )
        return AuthResponse(
            token=access_token,
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_at=expires_at,
            inactivity_timeout_minutes=self.settings.session_inactivity_minutes,
            user=user_response,
        )

    def _create_session(self, user: User) -> AuthResponse:
        now = self._now()
        session_id = str(uuid4())
        refresh_secret = secrets.token_urlsafe(32)
        refresh_token = f"{session_id}.{refresh_secret}"
        self.session_repository.create(
            session_id,
            user.id,
            hash_token(refresh_token),
            created_at=now,
            expires_at=now + timedelta(days=self.settings.session_lifetime_days),
        )
        return self._build_auth_response(
            user,
            session_id=session_id,
            refresh_token=refresh_token,
            now=now,
        )

    def _validate_refresh_session(
        self,
        refresh_token: str,
        *,
        now: datetime,
    ) -> SessionToken | None:
        try:
            session_id, _secret = refresh_token.split(".", 1)
        except ValueError:
            return None

        session_token = self.session_repository.get(session_id)
        if session_token is None or not session_token.refresh_token_hash:
            return None
        if not self.session_repository.is_active(
            session_token,
            now=now,
            inactivity_timeout=self._inactivity_timeout(),
        ):
            self.session_repository.revoke(session_id, revoked_at=now)
            return None
        if not secrets.compare_digest(hash_token(refresh_token), session_token.refresh_token_hash):
            return None
        return session_token

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
        auth_response = self._create_session(user)
        self._log(user, "register", f"Registered {user.email}")
        return auth_response

    def login(self, payload: LoginRequest) -> AuthResponse:
        user = self.user_repository.get_by_email(payload.email)
        if user is None:
            self._log(None, "failed_login", f"Unknown email {payload.email}")
            raise ValueError("Invalid email or password")

        if not verify_password(payload.password, user.password_hash):
            self._log(user, "failed_login", f"Failed login for {payload.email}")
            raise ValueError("Invalid email or password")

        if needs_password_rehash(user.password_hash):
            self.user_repository.update_password_hash(user.id, self._hash_password(payload.password))
            user = self.user_repository.get_by_id(user.id) or user

        auth_response = self._create_session(user)
        self._log(user, "login", f"Logged in {payload.email}")
        return auth_response

    def refresh(self, payload: RefreshRequest) -> AuthResponse:
        now = self._now()
        session_token = self._validate_refresh_session(payload.refresh_token, now=now)
        if session_token is None:
            raise ValueError("Invalid or expired refresh token")

        user = self.user_repository.get_by_id(session_token.user_id)
        if user is None:
            self.session_repository.revoke(session_token.token, revoked_at=now)
            raise ValueError("Invalid or expired refresh token")

        refresh_secret = secrets.token_urlsafe(32)
        refresh_token = f"{session_token.token}.{refresh_secret}"
        self.session_repository.rotate_refresh_token(
            session_token.token,
            refresh_token_hash=hash_token(refresh_token),
            now=now,
        )
        self._log(user, "refresh_session", "Refreshed access token")
        return self._build_auth_response(
            user,
            session_id=session_token.token,
            refresh_token=refresh_token,
            now=now,
        )

    def get_current_user(self, token: str) -> UserResponse | None:
        try:
            payload = self._decode_access_token(token)
        except TokenError:
            return None

        now = self._now()
        session_token = self.session_repository.validate(
            payload["sid"],
            now=now,
            inactivity_timeout=self._inactivity_timeout(),
        )
        if session_token is None or session_token.user_id != payload["sub"]:
            return None

        user = self.user_repository.get_by_id(session_token.user_id)
        if user is None:
            return None

        return self._to_user_response(user)

    def logout(self, token: str) -> bool:
        try:
            payload = self._decode_access_token(token, verify_exp=False)
        except TokenError:
            return False

        user = self.user_repository.get_by_id(payload["sub"])
        revoked = self.session_repository.revoke(payload["sid"], revoked_at=self._now())
        if revoked:
            self._log(user, "logout", "Logged out")
        return revoked

    def request_password_reset(
        self,
        payload: PasswordResetRequest,
    ) -> PasswordResetResponse:
        user = self.user_repository.get_by_email(payload.email)
        message = "If the email exists, a reset token has been created."
        if user is None:
            self._log(None, "password_reset_request", f"Unknown email {payload.email}")
            return PasswordResetResponse(message=message)

        now = self._now()
        reset_token = secrets.token_urlsafe(32)
        self.password_reset_repository.create(
            PasswordResetToken(
                id=str(uuid4()),
                user_id=user.id,
                token_hash=hash_token(reset_token),
                created_at=now,
                expires_at=now + timedelta(minutes=self.settings.password_reset_minutes),
            )
        )
        self._log(user, "password_reset_request", "Password reset token created")
        return PasswordResetResponse(
            message=message,
            reset_token=reset_token if self.settings.auth_expose_reset_token else None,
        )

    def reset_password(self, payload: PasswordResetConfirmRequest) -> PasswordResetResponse:
        now = self._now()
        token_hash = hash_token(payload.token)
        reset_token = self.password_reset_repository.get_by_hash(token_hash)
        if reset_token is None:
            raise ValueError("Invalid or expired password reset token")
        if reset_token.used_at is not None:
            raise ValueError("Password reset token has already been used")
        if self._make_aware(reset_token.expires_at) <= now:
            raise ValueError("Invalid or expired password reset token")

        user = self.user_repository.get_by_id(reset_token.user_id)
        if user is None:
            raise ValueError("Invalid or expired password reset token")

        self.user_repository.update_password_hash(user.id, self._hash_password(payload.new_password))
        self.password_reset_repository.mark_used(reset_token.id, used_at=now)
        self.session_repository.revoke_all_for_user(user.id, revoked_at=now)
        self._log(user, "password_reset_complete", "Password was reset")
        return PasswordResetResponse(message="Password reset successfully.")
