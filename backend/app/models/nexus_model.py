from dataclasses import dataclass


@dataclass
class NexusNode:
    user_id: str
    id: str
    book_title: str
    quote: str
    x: float
    y: float


@dataclass
class NexusEdge:
    user_id: str
    id: str
    source_id: str
    target_id: str
    label: str | None = None