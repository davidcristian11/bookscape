from collections import Counter

from app.repositories.book_repository import BookRepository
from app.schemas.book import BookStatus, StatsResponse


class StatsService:
    def __init__(self, repository: BookRepository) -> None:
        self.repository = repository

    def get_stats(self, user_id: str) -> StatsResponse:
        books = self.repository.list_all(user_id)
        total_books = len(books)

        average_rating = None
        if total_books > 0:
            average_rating = round(
                sum(book.rating for book in books) / total_books,
                2
            )

        status_counter = Counter(book.status for book in books)
        books_by_status = {
            status.value: status_counter.get(status.value, 0)
            for status in BookStatus
        }

        genre_counter = Counter(book.genre for book in books)
        books_by_genre = dict(sorted(genre_counter.items()))

        return StatsResponse(
            total_books=total_books,
            average_rating=average_rating,
            books_by_status=books_by_status,
            books_by_genre=books_by_genre,
        )