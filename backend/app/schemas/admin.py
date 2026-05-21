from datetime import datetime

from pydantic import BaseModel, ConfigDict


class LogEntryResponse(BaseModel):
    id: str
    user_id: str | None
    user_email: str | None = None
    role_name: str
    action: str
    details: str
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)


class ObservationListEntryResponse(BaseModel):
    id: str
    user_id: str
    user_email: str | None = None
    user_name: str | None = None
    role_name: str
    reason: str
    score: int
    last_action_at: datetime
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
