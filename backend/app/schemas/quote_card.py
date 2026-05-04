from pydantic import BaseModel, ConfigDict, Field, field_validator


def _validate_non_blank(value: str, field_name: str) -> str:
    cleaned = value.strip()
    if not cleaned:
        raise ValueError(f"{field_name} must not be blank")
    return cleaned


class QuoteCardCreate(BaseModel):
    text: str = Field(..., min_length=1, max_length=1000)
    note: str | None = Field(default=None, max_length=1000)
    tag: str | None = Field(default=None, max_length=100)

    @field_validator("text", mode="before")
    @classmethod
    def validate_text(cls, value: str) -> str:
        return _validate_non_blank(value, "text")

    @field_validator("note", "tag", mode="before")
    @classmethod
    def validate_optional_fields(cls, value: str | None) -> str | None:
        if value is None:
            return None

        cleaned = value.strip()
        return cleaned or None


class QuoteCardUpdate(BaseModel):
    text: str | None = Field(default=None, min_length=1, max_length=1000)
    note: str | None = Field(default=None, max_length=1000)
    tag: str | None = Field(default=None, max_length=100)

    @field_validator("text", mode="before")
    @classmethod
    def validate_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _validate_non_blank(value, "text")

    @field_validator("note", "tag", mode="before")
    @classmethod
    def validate_optional_fields(cls, value: str | None) -> str | None:
        if value is None:
            return None

        cleaned = value.strip()
        return cleaned or None


class QuoteCardResponse(BaseModel):
    id: str
    book_id: str
    text: str
    note: str | None = None
    tag: str | None = None

    model_config = ConfigDict(from_attributes=True)


class QuoteStatsResponse(BaseModel):
    total_quotes: int
    quotes_by_book: dict[str, int]
    quotes_by_tag: dict[str, int]