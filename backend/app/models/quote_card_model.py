from dataclasses import dataclass
from datetime import datetime


@dataclass
class QuoteCard:
    user_id: str
    id: str
    book_id: str
    quote: str
    note: str | None = None
    relationship_label: str | None = None
    position_x: float = 0
    position_y: float = 0
    created_at: datetime | None = None
    updated_at: datetime | None = None
