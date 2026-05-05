from dataclasses import dataclass
from datetime import datetime


@dataclass
class Book:
    user_id: str
    id: str
    title: str
    author: str
    genre: str
    publication_year: int
    source: str
    source_url: str | None
    synopsis: str
    review: str
    rating: int
    cover_url: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
