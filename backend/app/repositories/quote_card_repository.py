from sqlalchemy import delete, select

from app.database import session_scope
from app.models.quote_card_model import QuoteCard


class QuoteCardRepository:
    def create(self, quote: QuoteCard) -> QuoteCard:
        with session_scope() as session:
            session.add(quote)
            session.flush()
            session.refresh(quote)
            return quote

    def list_by_book(self, user_id: str, book_id: str) -> list[QuoteCard]:
        with session_scope() as session:
            return list(
                session.scalars(
                    select(QuoteCard)
                    .where(QuoteCard.user_id == user_id, QuoteCard.book_id == book_id)
                    .order_by(QuoteCard.created_at.asc())
                ).all()
            )

    def list_all(self, user_id: str) -> list[QuoteCard]:
        with session_scope() as session:
            return list(
                session.scalars(
                    select(QuoteCard)
                    .where(QuoteCard.user_id == user_id)
                    .order_by(QuoteCard.created_at.asc())
                ).all()
            )

    def get_by_id(self, user_id: str, quote_id: str) -> QuoteCard | None:
        with session_scope() as session:
            return session.scalar(
                select(QuoteCard).where(QuoteCard.id == quote_id, QuoteCard.user_id == user_id)
            )

    def update(
        self,
        user_id: str,
        quote_id: str,
        updated_quote: QuoteCard,
    ) -> QuoteCard | None:
        with session_scope() as session:
            existing = session.scalar(
                select(QuoteCard).where(QuoteCard.id == quote_id, QuoteCard.user_id == user_id)
            )
            if existing is None:
                return None

            for field in (
                "quote",
                "note",
                "relationship_label",
                "position_x",
                "position_y",
                "updated_at",
            ):
                setattr(existing, field, getattr(updated_quote, field))

            session.flush()
            session.refresh(existing)
            return existing

    def delete(self, user_id: str, quote_id: str) -> bool:
        with session_scope() as session:
            existing = session.scalar(
                select(QuoteCard).where(QuoteCard.id == quote_id, QuoteCard.user_id == user_id)
            )
            if existing is None:
                return False

            session.delete(existing)
            return True

    def delete_by_book(self, user_id: str, book_id: str) -> None:
        with session_scope() as session:
            session.execute(
                delete(QuoteCard).where(
                    QuoteCard.user_id == user_id,
                    QuoteCard.book_id == book_id,
                )
            )

    def clear(self) -> None:
        with session_scope() as session:
            session.execute(delete(QuoteCard))
