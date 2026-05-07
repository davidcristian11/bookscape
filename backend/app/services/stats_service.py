from collections import Counter, defaultdict

from app.repositories.book_repository import BookRepository
from app.repositories.quote_card_repository import QuoteCardRepository
from app.schemas.book import StatsResponse


class StatsService:
    def __init__(
        self,
        book_repository: BookRepository,
        quote_repository: QuoteCardRepository,
    ) -> None:
        self.book_repository = book_repository
        self.quote_repository = quote_repository

    def get_stats(self, user_id: str) -> StatsResponse:
        books = self.book_repository.list_all(user_id)
        quotes = self.quote_repository.list_all(user_id)
        total_books = len(books)

        average_rating = None
        if total_books > 0:
            average_rating = round(sum(book.rating for book in books) / total_books, 2)

        genre_counter = Counter(book.genre for book in books)
        source_counter = Counter(book.source for book in books)
        month_counter = Counter(
            (book.created_at.strftime("%Y-%m") if book.created_at else "unknown")
            for book in books
        )

        source_ratings: dict[str, list[int]] = defaultdict(list)
        for book in books:
            source_ratings[book.source].append(book.rating)

        top_rated_sources = {
            source: round(sum(ratings) / len(ratings), 2)
            for source, ratings in sorted(source_ratings.items())
            if ratings
        }

        title_by_id = {book.id: book.title for book in books}
        quote_counter = Counter(quote.book_id for quote in quotes)
        quotes_per_book = {
            title_by_id.get(book_id, book_id): count
            for book_id, count in sorted(quote_counter.items())
        }

        return StatsResponse(
            total_books=total_books,
            average_rating=average_rating,
            books_by_genre=dict(sorted(genre_counter.items())),
            books_by_source=dict(sorted(source_counter.items())),
            books_by_month=dict(sorted(month_counter.items())),
            top_rated_sources=top_rated_sources,
            quotes_per_book=quotes_per_book,
        )
