from sqlalchemy import delete, func, select

from app.database import session_scope
from app.models.book_model import Book
from app.models.quote_card_model import QuoteCard


class BookRepository:
    def _book_filters(
        self,
        user_id: str,
        *,
        genre: str | None = None,
        source: str | None = None,
        rating_min: int | None = None,
        rating_max: int | None = None,
        search: str | None = None,
    ) -> list:
        filters = [Book.user_id == user_id]
        if genre:
            filters.append(Book.genre == genre)
        if source:
            filters.append(Book.source == source)
        if rating_min is not None:
            filters.append(Book.rating >= rating_min)
        if rating_max is not None:
            filters.append(Book.rating <= rating_max)
        if search:
            pattern = f"%{search}%"
            filters.append(Book.title.ilike(pattern) | Book.author.ilike(pattern))
        return filters

    def create(self, book: Book) -> Book:
        with session_scope() as session:
            session.add(book)
            session.flush()
            session.refresh(book)
            return book

    def list_all(self, user_id: str) -> list[Book]:
        with session_scope() as session:
            return list(
                session.scalars(
                    select(Book)
                    .where(Book.user_id == user_id)
                    .order_by(Book.created_at.desc())
                ).all()
            )

    def list_page(
        self,
        user_id: str,
        page: int,
        page_size: int,
        *,
        genre: str | None = None,
        source: str | None = None,
        rating_min: int | None = None,
        rating_max: int | None = None,
        search: str | None = None,
    ) -> tuple[list[Book], int]:
        offset = (page - 1) * page_size
        filters = self._book_filters(
            user_id,
            genre=genre,
            source=source,
            rating_min=rating_min,
            rating_max=rating_max,
            search=search,
        )
        with session_scope() as session:
            total = session.scalar(
                select(func.count()).select_from(Book).where(*filters)
            ) or 0
            books = list(
                session.scalars(
                    select(Book)
                    .where(*filters)
                    .order_by(Book.created_at.desc())
                    .offset(offset)
                    .limit(page_size)
                ).all()
            )
            return books, total

    def get_by_id(self, book_id: str, user_id: str) -> Book | None:
        with session_scope() as session:
            return session.scalar(
                select(Book).where(Book.id == book_id, Book.user_id == user_id)
            )

    def update(self, book_id: str, user_id: str, updated_book: Book) -> Book | None:
        with session_scope() as session:
            existing = session.scalar(
                select(Book).where(Book.id == book_id, Book.user_id == user_id)
            )
            if existing is None:
                return None

            for field in (
                "title",
                "author",
                "genre",
                "publication_year",
                "source",
                "source_url",
                "synopsis",
                "review",
                "rating",
                "cover_url",
                "updated_at",
            ):
                setattr(existing, field, getattr(updated_book, field))

            session.flush()
            session.refresh(existing)
            return existing

    def delete(self, book_id: str, user_id: str) -> bool:
        with session_scope() as session:
            existing = session.scalar(
                select(Book).where(Book.id == book_id, Book.user_id == user_id)
            )
            if existing is None:
                return False

            session.delete(existing)
            return True

    def clear(self) -> None:
        with session_scope() as session:
            session.execute(delete(QuoteCard))
            session.execute(delete(Book))
