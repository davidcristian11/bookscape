from dataclasses import dataclass


@dataclass
class Book:
    user_id: str
    id: str
    title: str
    author: str
    genre: str
    year: int
    status: str
    rating: int
    cover_url: str | None = None