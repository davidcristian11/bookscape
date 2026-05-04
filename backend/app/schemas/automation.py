from pydantic import BaseModel, Field


class FakerLoopStartRequest(BaseModel):
    interval_seconds: float = Field(default=3.0, ge=0.2, le=60.0)


class FakerLoopStatusResponse(BaseModel):
    message: str
    running: bool
    interval_seconds: float | None = None