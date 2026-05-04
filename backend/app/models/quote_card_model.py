from dataclasses import dataclass


@dataclass
class QuoteCard:
    user_id: str
    id: str
    book_id: str
    text: str
    note: str | None = None
    tag: str | None = None