from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator

CURRENT_YEAR = datetime.now().year


class BookStatus(str, Enum):
    TO_READ = "to-read"
    READING = "reading"
    FINISHED = "finished"


def _validate_non_blank(value: str | None, field_name: str) -> str | None:
    if value is None:
        return None

    cleaned = value.strip()
    if not cleaned:
        raise ValueError(f"{field_name} must not be blank")

    return cleaned


class BookBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    author: str = Field(..., min_length=1, max_length=120)
    genre: str = Field(..., min_length=1, max_length=80)
    year: int = Field(..., ge=0, le=CURRENT_YEAR)
    status: BookStatus
    rating: int = Field(..., ge=0, le=5)
    cover_url: HttpUrl | None = None

    @field_validator("title", mode="before")
    @classmethod
    def validate_title(cls, value: str) -> str:
        return _validate_non_blank(value, "title")

    @field_validator("author", mode="before")
    @classmethod
    def validate_author(cls, value: str) -> str:
        return _validate_non_blank(value, "author")

    @field_validator("genre", mode="before")
    @classmethod
    def validate_genre(cls, value: str) -> str:
        return _validate_non_blank(value, "genre")


class BookCreate(BookBase):
    pass


class BookUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=200)
    author: str | None = Field(None, min_length=1, max_length=120)
    genre: str | None = Field(None, min_length=1, max_length=80)
    year: int | None = Field(None, ge=0, le=CURRENT_YEAR)
    status: BookStatus | None = None
    rating: int | None = Field(None, ge=0, le=5)
    cover_url: HttpUrl | None = None

    @field_validator("title", mode="before")
    @classmethod
    def validate_title(cls, value: str | None) -> str | None:
        return _validate_non_blank(value, "title")

    @field_validator("author", mode="before")
    @classmethod
    def validate_author(cls, value: str | None) -> str | None:
        return _validate_non_blank(value, "author")

    @field_validator("genre", mode="before")
    @classmethod
    def validate_genre(cls, value: str | None) -> str | None:
        return _validate_non_blank(value, "genre")


class BookResponse(BookBase):
    id: str

    model_config = ConfigDict(from_attributes=True)


class PaginatedBooksResponse(BaseModel):
    items: list[BookResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class StatsResponse(BaseModel):
    total_books: int
    average_rating: float | None
    books_by_status: dict[str, int]
    books_by_genre: dict[str, int]