from collections import Counter
from datetime import datetime, timezone
from uuid import uuid4

from app.models.quote_card_model import QuoteCard
from app.repositories.book_repository import BookRepository
from app.repositories.quote_card_repository import QuoteCardRepository
from app.schemas.quote_card import (
    QuoteCardCreate,
    QuoteCardResponse,
    QuoteCardUpdate,
    QuoteStatsResponse,
)


class QuoteCardService:
    def __init__(
        self,
        quote_repository: QuoteCardRepository,
        book_repository: BookRepository,
    ) -> None:
        self.quote_repository = quote_repository
        self.book_repository = book_repository

    def _now(self) -> datetime:
        return datetime.now(timezone.utc)

    def list_quotes_by_book(
        self,
        user_id: str,
        book_id: str,
    ) -> list[QuoteCardResponse] | None:
        book = self.book_repository.get_by_id(book_id, user_id)
        if book is None:
            return None

        quotes = self.quote_repository.list_by_book(user_id, book_id)
        return [QuoteCardResponse.model_validate(quote) for quote in quotes]

    def create_quote(
        self,
        user_id: str,
        book_id: str,
        payload: QuoteCardCreate,
    ) -> QuoteCardResponse | None:
        book = self.book_repository.get_by_id(book_id, user_id)
        if book is None:
            return None

        now = self._now()
        quote = QuoteCard(
            user_id=user_id,
            id=str(uuid4()),
            book_id=book_id,
            quote=payload.quote,
            note=payload.note,
            relationship_label=payload.relationship_label,
            position_x=payload.position_x,
            position_y=payload.position_y,
            created_at=now,
            updated_at=now,
        )

        return QuoteCardResponse.model_validate(self.quote_repository.create(quote))

    def update_quote(
        self,
        user_id: str,
        quote_id: str,
        payload: QuoteCardUpdate,
    ) -> QuoteCardResponse | None:
        existing_quote = self.quote_repository.get_by_id(user_id, quote_id)
        if existing_quote is None:
            return None

        updated_quote = QuoteCard(
            user_id=existing_quote.user_id,
            id=existing_quote.id,
            book_id=existing_quote.book_id,
            quote=payload.quote if payload.quote is not None else existing_quote.quote,
            note=payload.note if payload.note is not None else existing_quote.note,
            relationship_label=(
                payload.relationship_label
                if payload.relationship_label is not None
                else existing_quote.relationship_label
            ),
            position_x=(
                payload.position_x
                if payload.position_x is not None
                else existing_quote.position_x
            ),
            position_y=(
                payload.position_y
                if payload.position_y is not None
                else existing_quote.position_y
            ),
            created_at=existing_quote.created_at,
            updated_at=self._now(),
        )

        saved = self.quote_repository.update(user_id, quote_id, updated_quote)
        return QuoteCardResponse.model_validate(saved) if saved else None

    def delete_quote(self, user_id: str, quote_id: str) -> bool:
        return self.quote_repository.delete(user_id, quote_id)

    def delete_quotes_for_book(self, user_id: str, book_id: str) -> None:
        self.quote_repository.delete_by_book(user_id, book_id)

    def get_quote_stats(self, user_id: str) -> QuoteStatsResponse:
        quotes = self.quote_repository.list_all(user_id)

        book_titles = {
            book.id: book.title
            for book in self.book_repository.list_all(user_id)
        }
        book_counter = Counter(book_titles.get(quote.book_id, quote.book_id) for quote in quotes)
        relationship_counter = Counter(
            quote.relationship_label for quote in quotes if quote.relationship_label is not None
        )

        return QuoteStatsResponse(
            total_quotes=len(quotes),
            quotes_by_book=dict(sorted(book_counter.items())),
            quotes_by_relationship=dict(sorted(relationship_counter.items())),
        )
