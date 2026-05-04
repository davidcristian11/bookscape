from pydantic import BaseModel, ConfigDict, Field, field_validator


def _validate_non_blank(value: str, field_name: str) -> str:
    cleaned = value.strip()
    if not cleaned:
        raise ValueError(f"{field_name} must not be blank")
    return cleaned


class NexusNodeCreate(BaseModel):
    book_title: str = Field(..., min_length=1, max_length=200)
    quote: str = Field(..., min_length=1, max_length=1000)
    x: float = 100.0
    y: float = 100.0

    @field_validator("book_title", mode="before")
    @classmethod
    def validate_book_title(cls, value: str) -> str:
        return _validate_non_blank(value, "book_title")

    @field_validator("quote", mode="before")
    @classmethod
    def validate_quote(cls, value: str) -> str:
        return _validate_non_blank(value, "quote")


class NexusNodeUpdate(BaseModel):
    book_title: str | None = Field(None, min_length=1, max_length=200)
    quote: str | None = Field(None, min_length=1, max_length=1000)
    x: float | None = None
    y: float | None = None

    @field_validator("book_title", mode="before")
    @classmethod
    def validate_book_title(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _validate_non_blank(value, "book_title")

    @field_validator("quote", mode="before")
    @classmethod
    def validate_quote(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _validate_non_blank(value, "quote")


class NexusNodeResponse(BaseModel):
    id: str
    book_title: str
    quote: str
    x: float
    y: float

    model_config = ConfigDict(from_attributes=True)


class NexusEdgeCreate(BaseModel):
    source_id: str
    target_id: str
    label: str | None = Field(default=None, max_length=100)

    @field_validator("source_id", "target_id", mode="before")
    @classmethod
    def validate_ids(cls, value: str) -> str:
        return _validate_non_blank(value, "id")

    @field_validator("label", mode="before")
    @classmethod
    def validate_label(cls, value: str | None) -> str | None:
        if value is None:
            return None

        cleaned = value.strip()
        return cleaned or None


class NexusEdgeResponse(BaseModel):
    id: str
    source_id: str
    target_id: str
    label: str | None = None

    model_config = ConfigDict(from_attributes=True)


class NexusGraphResponse(BaseModel):
    nodes: list[NexusNodeResponse]
    edges: list[NexusEdgeResponse]