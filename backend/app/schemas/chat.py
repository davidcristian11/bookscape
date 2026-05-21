from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class ChatMessageCreate(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)

    @field_validator("message", mode="before")
    @classmethod
    def clean_message(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("message must not be blank")
        return cleaned


class ChatMessageResponse(BaseModel):
    id: str
    user_id: str
    user_name: str
    role_name: str
    message: str
    created_at: datetime
