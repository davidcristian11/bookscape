from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator, model_validator

CURRENT_YEAR = datetime.now().year
SUPPORTED_SOURCES = ("Goodreads", "Amazon", "Barnes & Noble", "Open Library", "Manual")


def _clean_optional(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


def _clean_required(value: str, field_name: str) -> str:
    cleaned = value.strip()
    if not cleaned:
        raise ValueError(f"{field_name} must not be blank")
    return cleaned


class BookBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    author: str = Field(..., min_length=1, max_length=120)
    genre: str = Field(..., min_length=1, max_length=80)
    publication_year: int = Field(..., ge=0, le=CURRENT_YEAR)
    source: str = Field(default="Manual", min_length=1, max_length=80)
    source_url: HttpUrl | None = None
    synopsis: str = Field(default="", max_length=4000)
    review: str = Field(default="", max_length=4000)
    rating: int = Field(..., ge=0, le=5)
    cover_url: HttpUrl | None = None

    @field_validator("title", "author", "genre", "source", mode="before")
    @classmethod
    def validate_required_text(cls, value: str, info) -> str:
        return _clean_required(value, info.field_name)

    @field_validator("synopsis", "review", mode="before")
    @classmethod
    def validate_optional_text(cls, value: str | None) -> str:
        return _clean_optional(value) or ""


class BookCreate(BookBase):
    year: int | None = Field(default=None, exclude=True)
    status: str | None = Field(default=None, exclude=True)

    @model_validator(mode="before")
    @classmethod
    def accept_legacy_year(cls, data):
        if isinstance(data, dict) and "publication_year" not in data and "year" in data:
            data = {**data, "publication_year": data["year"]}
        return data


class BookUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=200)
    author: str | None = Field(None, min_length=1, max_length=120)
    genre: str | None = Field(None, min_length=1, max_length=80)
    publication_year: int | None = Field(None, ge=0, le=CURRENT_YEAR)
    source: str | None = Field(None, min_length=1, max_length=80)
    source_url: HttpUrl | None = None
    synopsis: str | None = Field(None, max_length=4000)
    review: str | None = Field(None, max_length=4000)
    rating: int | None = Field(None, ge=0, le=5)
    cover_url: HttpUrl | None = None
    year: int | None = Field(default=None, exclude=True)
    status: str | None = Field(default=None, exclude=True)

    @model_validator(mode="before")
    @classmethod
    def accept_legacy_year(cls, data):
        if isinstance(data, dict) and "publication_year" not in data and "year" in data:
            data = {**data, "publication_year": data["year"]}
        return data

    @field_validator("title", "author", "genre", "source", mode="before")
    @classmethod
    def validate_required_text(cls, value: str | None, info) -> str | None:
        if value is None:
            return None
        return _clean_required(value, info.field_name)

    @field_validator("synopsis", "review", mode="before")
    @classmethod
    def validate_optional_text(cls, value: str | None) -> str | None:
        return _clean_optional(value)


class ScrapeBookRequest(BaseModel):
    url: HttpUrl

    @field_validator("url")
    @classmethod
    def validate_scrape_url(cls, value: HttpUrl) -> HttpUrl:
        if value.scheme not in {"http", "https"}:
            raise ValueError("Scrape URL must use http or https")
        return value


class BookResponse(BookBase):
    id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @property
    def year(self) -> int:
        return self.publication_year


class PaginatedBooksResponse(BaseModel):
    items: list[BookResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class StatsResponse(BaseModel):
    total_books: int
    average_rating: float | None
    books_by_genre: dict[str, int]
    books_by_source: dict[str, int]
    books_by_month: dict[str, int]
    top_rated_sources: dict[str, float]
    quotes_per_book: dict[str, int] = {}
