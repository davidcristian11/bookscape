from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


def _clean_required(value: str, field_name: str) -> str:
    cleaned = value.strip()
    if not cleaned:
        raise ValueError(f"{field_name} must not be blank")
    return cleaned


def _clean_optional(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


class QuoteCardCreate(BaseModel):
    quote: str = Field(..., min_length=1, max_length=1000)
    note: str | None = Field(default=None, max_length=1000)
    relationship_label: str | None = Field(default=None, max_length=100)
    position_x: float = 0
    position_y: float = 0
    text: str | None = Field(default=None, exclude=True)
    tag: str | None = Field(default=None, exclude=True)

    @model_validator(mode="before")
    @classmethod
    def accept_legacy_names(cls, data):
        if isinstance(data, dict):
            next_data = dict(data)
            if "quote" not in next_data and "text" in next_data:
                next_data["quote"] = next_data["text"]
            if "relationship_label" not in next_data and "tag" in next_data:
                next_data["relationship_label"] = next_data["tag"]
            return next_data
        return data

    @field_validator("quote", mode="before")
    @classmethod
    def validate_quote(cls, value: str) -> str:
        return _clean_required(value, "quote")

    @field_validator("note", "relationship_label", mode="before")
    @classmethod
    def validate_optional_fields(cls, value: str | None) -> str | None:
        return _clean_optional(value)


class QuoteCardUpdate(BaseModel):
    quote: str | None = Field(default=None, min_length=1, max_length=1000)
    note: str | None = Field(default=None, max_length=1000)
    relationship_label: str | None = Field(default=None, max_length=100)
    position_x: float | None = None
    position_y: float | None = None
    text: str | None = Field(default=None, exclude=True)
    tag: str | None = Field(default=None, exclude=True)

    @model_validator(mode="before")
    @classmethod
    def accept_legacy_names(cls, data):
        if isinstance(data, dict):
            next_data = dict(data)
            if "quote" not in next_data and "text" in next_data:
                next_data["quote"] = next_data["text"]
            if "relationship_label" not in next_data and "tag" in next_data:
                next_data["relationship_label"] = next_data["tag"]
            return next_data
        return data

    @field_validator("quote", mode="before")
    @classmethod
    def validate_quote(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _clean_required(value, "quote")

    @field_validator("note", "relationship_label", mode="before")
    @classmethod
    def validate_optional_fields(cls, value: str | None) -> str | None:
        return _clean_optional(value)


class QuoteCardResponse(BaseModel):
    id: str
    book_id: str
    quote: str
    note: str | None = None
    relationship_label: str | None = None
    position_x: float = 0
    position_y: float = 0
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class QuoteStatsResponse(BaseModel):
    total_quotes: int
    quotes_by_book: dict[str, int]
    quotes_by_relationship: dict[str, int]
