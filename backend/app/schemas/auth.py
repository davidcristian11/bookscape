from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _validate_non_blank(value: str, field_name: str) -> str:
    cleaned = value.strip()
    if not cleaned:
        raise ValueError(f"{field_name} must not be blank")
    return cleaned


class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: str = Field(..., min_length=5, max_length=150)
    password: str = Field(..., min_length=4, max_length=100)

    @field_validator("name", mode="before")
    @classmethod
    def validate_name(cls, value: str) -> str:
        return _validate_non_blank(value, "name")

    @field_validator("email", mode="before")
    @classmethod
    def validate_email(cls, value: str) -> str:
        cleaned = _validate_non_blank(value, "email").lower()
        if "@" not in cleaned:
            raise ValueError("email must be valid")
        return cleaned


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=150)
    password: str = Field(..., min_length=4, max_length=100)

    @field_validator("email", mode="before")
    @classmethod
    def validate_email(cls, value: str) -> str:
        cleaned = _validate_non_blank(value, "email").lower()
        if "@" not in cleaned:
            raise ValueError("email must be valid")
        return cleaned


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str = "user"
    roles: list[str] = Field(default_factory=list)
    permissions: list[str] = Field(default_factory=list)
    is_admin: bool = False

    model_config = ConfigDict(from_attributes=True)


class AuthResponse(BaseModel):
    token: str
    access_token: str | None = None
    refresh_token: str | None = None
    token_type: str = "bearer"
    expires_at: datetime | None = None
    inactivity_timeout_minutes: int | None = None
    user: UserResponse


class RefreshRequest(BaseModel):
    refresh_token: str = Field(..., min_length=20, max_length=300)


class PasswordResetRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=150)

    @field_validator("email", mode="before")
    @classmethod
    def validate_email(cls, value: str) -> str:
        cleaned = _validate_non_blank(value, "email").lower()
        if "@" not in cleaned:
            raise ValueError("email must be valid")
        return cleaned


class PasswordResetConfirmRequest(BaseModel):
    token: str = Field(..., min_length=20, max_length=300)
    new_password: str = Field(..., min_length=4, max_length=100)


class PasswordResetResponse(BaseModel):
    message: str
    reset_token: str | None = None
