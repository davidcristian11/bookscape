from app.models.book_model import Book


class BookRepository:
    def __init__(self) -> None:
        self._books: dict[str, Book] = {}

    def create(self, book: Book) -> Book:
        self._books[book.id] = book
        return book

    def list_all(self, user_id: str) -> list[Book]:
        return [book for book in self._books.values() if book.user_id == user_id]

    def get_by_id(self, book_id: str, user_id: str) -> Book | None:
        book = self._books.get(book_id)
        if book is None or book.user_id != user_id:
            return None
        return book

    def update(self, book_id: str, user_id: str, updated_book: Book) -> Book | None:
        existing = self._books.get(book_id)
        if existing is None or existing.user_id != user_id:
            return None

        self._books[book_id] = updated_book
        return updated_book

    def delete(self, book_id: str, user_id: str) -> bool:
        existing = self._books.get(book_id)
        if existing is None or existing.user_id != user_id:
            return False

        self._books.pop(book_id, None)
        return True

    def clear(self) -> None:
        self._books.clear()