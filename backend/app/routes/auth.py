from fastapi import APIRouter, Body, Depends, Header, HTTPException, status

from app.dependencies import auth_service, logging_service, seed_service
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

router = APIRouter(prefix="/auth", tags=["auth"])


def _extract_bearer_token(authorization: str | None) -> str:
    if authorization is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
        )

    prefix = "Bearer "
    if not authorization.startswith(prefix):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Authorization header",
        )

    token = authorization[len(prefix):].strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing token",
        )

    return token


def require_authenticated_user(
    authorization: str | None = Header(default=None),
) -> UserResponse:
    token = _extract_bearer_token(authorization)
    user = auth_service.get_current_user(token)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session",
        )

    return user


def require_admin_user(
    authorization: str | None = Header(default=None),
) -> UserResponse:
    user = require_authenticated_user(authorization)
    if not user.is_admin or "logs:read" not in user.permissions:
        logging_service.log_action(
            user_id=user.id,
            role_name=user.role,
            action="forbidden_action",
            details="Attempted to access admin-only area",
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return user


def require_role(*allowed_roles: str):
    def dependency(
        current_user: UserResponse = Depends(require_authenticated_user),
    ) -> UserResponse:
        if not set(allowed_roles).intersection(current_user.roles):
            logging_service.log_action(
                user_id=current_user.id,
                role_name=current_user.role,
                action="forbidden_action",
                details=f"Missing role: {', '.join(allowed_roles)}",
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient role",
            )
        return current_user

    return dependency


def require_permission(permission: str):
    def dependency(
        current_user: UserResponse = Depends(require_authenticated_user),
    ) -> UserResponse:
        if permission not in current_user.permissions:
            logging_service.log_action(
                user_id=current_user.id,
                role_name=current_user.role,
                action="forbidden_action",
                details=f"Missing permission: {permission}",
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permission",
            )
        return current_user

    return dependency


@router.post(
    "/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(payload: RegisterRequest = Body(...)) -> AuthResponse:
    try:
        seed_service.seed_auth_defaults()
        auth_response = auth_service.register(payload)
        seed_service.seed_user_library(auth_response.user.id)
        return auth_response
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest = Body(...)) -> AuthResponse:
    try:
        seed_service.seed_auth_defaults()
        return auth_service.login(payload)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc


@router.post("/refresh", response_model=AuthResponse)
def refresh(payload: RefreshRequest = Body(...)) -> AuthResponse:
    try:
        return auth_service.refresh(payload)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc


@router.get("/me", response_model=UserResponse)
def get_me(
    current_user: UserResponse = Depends(require_authenticated_user),
) -> UserResponse:
    return current_user


@router.post("/logout")
def logout(authorization: str | None = Header(default=None)) -> dict[str, str]:
    token = _extract_bearer_token(authorization)
    deleted = auth_service.logout(token)

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session",
        )

    return {"message": "Logged out successfully"}


@router.post("/password-reset/request", response_model=PasswordResetResponse)
def request_password_reset(
    payload: PasswordResetRequest = Body(...),
) -> PasswordResetResponse:
    return auth_service.request_password_reset(payload)


@router.post("/password-reset/confirm", response_model=PasswordResetResponse)
def reset_password(
    payload: PasswordResetConfirmRequest = Body(...),
) -> PasswordResetResponse:
    try:
        return auth_service.reset_password(payload)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
