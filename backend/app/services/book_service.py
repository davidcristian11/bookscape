from datetime import datetime, timezone
from math import ceil
from uuid import uuid4

from app.models.book_model import Book
from app.repositories.book_repository import BookRepository
from app.schemas.book import BookCreate, BookResponse, BookUpdate, PaginatedBooksResponse, ScrapeBookRequest
from app.services.scraper_service import ScraperService


class BookService:
    def __init__(self, repository: BookRepository, scraper_service: ScraperService) -> None:
        self.repository = repository
        self.scraper_service = scraper_service

    def _now(self) -> datetime:
        return datetime.now(timezone.utc)

    def _to_response(self, book: Book) -> BookResponse:
        return BookResponse.model_validate(book)

    def create_book(self, user_id: str, payload: BookCreate) -> BookResponse:
        now = self._now()
        book = Book(
            user_id=user_id,
            id=str(uuid4()),
            title=payload.title,
            author=payload.author,
            genre=payload.genre,
            publication_year=payload.publication_year,
            source=payload.source,
            source_url=str(payload.source_url) if payload.source_url else None,
            synopsis=payload.synopsis,
            review=payload.review,
            rating=payload.rating,
            cover_url=str(payload.cover_url) if payload.cover_url else None,
            created_at=now,
            updated_at=now,
        )

        return self._to_response(self.repository.create(book))

    def scrape_book(self, user_id: str, payload: ScrapeBookRequest) -> BookResponse:
        scraped = self.scraper_service.scrape(str(payload.url))

        return self.create_book(
            user_id,
            BookCreate(
                title=scraped.title,
                author=scraped.author,
                genre=scraped.genre,
                publication_year=scraped.publication_year,
                source=scraped.source,
                source_url=scraped.source_url,
                synopsis=scraped.synopsis,
                review="",
                rating=scraped.rating,
                cover_url=scraped.cover_url,
            ),
        )

    def list_books(self, user_id: str, page: int, page_size: int) -> PaginatedBooksResponse:
        books = sorted(
            self.repository.list_all(user_id),
            key=lambda book: book.created_at or datetime.min.replace(tzinfo=timezone.utc),
            reverse=True,
        )
        total = len(books)
        total_pages = ceil(total / page_size) if total > 0 else 0
        start_index = (page - 1) * page_size
        paginated_books = books[start_index:start_index + page_size]

        return PaginatedBooksResponse(
            items=[self._to_response(book) for book in paginated_books],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )

    def get_book(self, user_id: str, book_id: str) -> BookResponse | None:
        book = self.repository.get_by_id(book_id, user_id)
        return self._to_response(book) if book else None

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
            publication_year=(
                payload.publication_year
                if payload.publication_year is not None
                else existing_book.publication_year
            ),
            source=payload.source if payload.source is not None else existing_book.source,
            source_url=(
                str(payload.source_url)
                if payload.source_url is not None
                else existing_book.source_url
            ),
            synopsis=payload.synopsis if payload.synopsis is not None else existing_book.synopsis,
            review=payload.review if payload.review is not None else existing_book.review,
            rating=payload.rating if payload.rating is not None else existing_book.rating,
            cover_url=(
                str(payload.cover_url)
                if payload.cover_url is not None
                else existing_book.cover_url
            ),
            created_at=existing_book.created_at,
            updated_at=self._now(),
        )

        saved = self.repository.update(book_id, user_id, updated_book)
        return self._to_response(saved) if saved else None

    def delete_book(self, user_id: str, book_id: str) -> bool:
        return self.repository.delete(book_id, user_id)
