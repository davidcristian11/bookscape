from math import ceil
from uuid import uuid4

from app.models.book_model import Book
from app.repositories.book_repository import BookRepository
from app.schemas.book import BookCreate, BookResponse, BookUpdate, PaginatedBooksResponse


class BookService:
    def __init__(self, repository: BookRepository) -> None:
        self.repository = repository

    def create_book(self, user_id: str, payload: BookCreate) -> BookResponse:
        book = Book(
            user_id=user_id,
            id=str(uuid4()),
            title=payload.title,
            author=payload.author,
            genre=payload.genre,
            year=payload.year,
            status=payload.status.value,
            rating=payload.rating,
            cover_url=str(payload.cover_url) if payload.cover_url else None,
        )

        created = self.repository.create(book)
        return BookResponse.model_validate(created)

    def list_books(self, user_id: str, page: int, page_size: int) -> PaginatedBooksResponse:
        books = self.repository.list_all(user_id)
        total = len(books)
        total_pages = ceil(total / page_size) if total > 0 else 0

        start_index = (page - 1) * page_size
        end_index = start_index + page_size
        paginated_books = books[start_index:end_index]

        return PaginatedBooksResponse(
            items=[BookResponse.model_validate(book) for book in paginated_books],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )

    def get_book(self, user_id: str, book_id: str) -> BookResponse | None:
        book = self.repository.get_by_id(book_id, user_id)
        if book is None:
            return None

        return BookResponse.model_validate(book)

    def update_book(self, user_id: str, book_id: str, payload: BookUpdate) -> BookResponse | None:
        existing_book = self.repository.get_by_id(book_id, user_id)
        if existing_book is None:
            return None

        updated_book = Book(
            user_id=existing_book.user_id,
            id=existing_book.id,
            title=payload.title if payload.title is not None else existing_book.title,
            author=payload.author if payload.author is not None else existing_book.author,
            genre=payload.genre if payload.genre is not None else existing_book.genre,
            year=payload.year if payload.year is not None else existing_book.year,
            status=payload.status.value if payload.status is not None else existing_book.status,
            rating=payload.rating if payload.rating is not None else existing_book.rating,
            cover_url=(
                str(payload.cover_url)
                if payload.cover_url is not None
                else existing_book.cover_url
            ),
        )

        saved = self.repository.update(book_id, user_id, updated_book)
        if saved is None:
            return None

        return BookResponse.model_validate(saved)

    def delete_book(self, user_id: str, book_id: str) -> bool:
        return self.repository.delete(book_id, user_id)