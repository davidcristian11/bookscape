from app.models.quote_card_model import QuoteCard


class QuoteCardRepository:
    def __init__(self) -> None:
        self._quotes: dict[str, QuoteCard] = {}

    def create(self, quote: QuoteCard) -> QuoteCard:
        self._quotes[quote.id] = quote
        return quote

    def list_by_book(self, user_id: str, book_id: str) -> list[QuoteCard]:
        return [
            quote
            for quote in self._quotes.values()
            if quote.user_id == user_id and quote.book_id == book_id
        ]

    def list_all(self, user_id: str) -> list[QuoteCard]:
        return [
            quote
            for quote in self._quotes.values()
            if quote.user_id == user_id
        ]

    def get_by_id(self, user_id: str, quote_id: str) -> QuoteCard | None:
        quote = self._quotes.get(quote_id)
        if quote is None or quote.user_id != user_id:
            return None
        return quote

    def update(
        self,
        user_id: str,
        quote_id: str,
        updated_quote: QuoteCard,
    ) -> QuoteCard | None:
        existing = self._quotes.get(quote_id)
        if existing is None or existing.user_id != user_id:
            return None

        self._quotes[quote_id] = updated_quote
        return updated_quote

    def delete(self, user_id: str, quote_id: str) -> bool:
        existing = self._quotes.get(quote_id)
        if existing is None or existing.user_id != user_id:
            return False

        self._quotes.pop(quote_id, None)
        return True

    def delete_by_book(self, user_id: str, book_id: str) -> None:
        quote_ids_to_delete = [
            quote.id
            for quote in self._quotes.values()
            if quote.user_id == user_id and quote.book_id == book_id
        ]

        for quote_id in quote_ids_to_delete:
            self._quotes.pop(quote_id, None)

    def clear(self) -> None:
        self._quotes.clear()