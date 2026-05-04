from __future__ import annotations

import strawberry
from fastapi import Request
from graphql import GraphQLError
from pydantic import ValidationError
from strawberry.types import Info

from app.dependencies import auth_service, book_service, quote_card_service
from app.routes.auth import _extract_bearer_token
from app.schemas.auth import UserResponse
from app.schemas.book import BookCreate, BookResponse, BookUpdate
from app.schemas.quote_card import (
    QuoteCardCreate,
    QuoteCardResponse,
    QuoteCardUpdate,
)


def _format_validation_error(exc: ValidationError) -> str:
    parts: list[str] = []

    for error in exc.errors():
        field = ".".join(str(item) for item in error.get("loc", []))
        message = error.get("msg", "Invalid value")
        parts.append(f"{field}: {message}")

    return " | ".join(parts) if parts else "Validation failed"


def _require_current_user(info: Info) -> UserResponse:
    current_user = info.context.get("current_user")
    if current_user is None:
        raise GraphQLError("Unauthorized")
    return current_user


@strawberry.type
class BookType:
    id: str
    title: str
    author: str
    genre: str
    year: int
    status: str
    rating: int
    cover_url: str | None = None


@strawberry.type
class QuoteCardType:
    id: str
    book_id: str
    text: str
    note: str | None = None
    tag: str | None = None


@strawberry.type
class BooksPageType:
    items: list[BookType]
    total: int
    page: int
    page_size: int
    total_pages: int


@strawberry.input
class CreateBookInput:
    title: str
    author: str
    genre: str
    year: int
    status: str
    rating: int
    cover_url: str | None = None


@strawberry.input
class UpdateBookInput:
    title: str | None = None
    author: str | None = None
    genre: str | None = None
    year: int | None = None
    status: str | None = None
    rating: int | None = None
    cover_url: str | None = None


@strawberry.input
class CreateQuoteInput:
    book_id: str
    text: str
    note: str | None = None
    tag: str | None = None


@strawberry.input
class UpdateQuoteInput:
    text: str | None = None
    note: str | None = None
    tag: str | None = None


def _map_book(book: BookResponse) -> BookType:
    return BookType(
        id=book.id,
        title=book.title,
        author=book.author,
        genre=book.genre,
        year=book.year,
        status=book.status.value if hasattr(book.status, "value") else str(book.status),
        rating=book.rating,
        cover_url=str(book.cover_url) if book.cover_url else None,
    )


def _map_quote(quote: QuoteCardResponse) -> QuoteCardType:
    return QuoteCardType(
        id=quote.id,
        book_id=quote.book_id,
        text=quote.text,
        note=quote.note,
        tag=quote.tag,
    )


async def get_graphql_context(request: Request) -> dict:
    authorization = request.headers.get("Authorization")
    current_user = None

    if authorization:
        try:
            token = _extract_bearer_token(authorization)
            current_user = auth_service.get_current_user(token)
        except Exception:
            current_user = None

    return {
        "request": request,
        "current_user": current_user,
    }


@strawberry.type
class Query:
    @strawberry.field
    async def books(
        self,
        info: Info,
        page: int = 1,
        page_size: int = 10,
    ) -> BooksPageType:
        current_user = _require_current_user(info)
        result = book_service.list_books(current_user.id, page, page_size)

        return BooksPageType(
            items=[_map_book(book) for book in result.items],
            total=result.total,
            page=result.page,
            page_size=result.page_size,
            total_pages=result.total_pages,
        )

    @strawberry.field
    async def book(self, info: Info, id: str) -> BookType | None:
        current_user = _require_current_user(info)
        book = book_service.get_book(current_user.id, id)

        if book is None:
            return None

        return _map_book(book)

    @strawberry.field
    async def quotes_by_book(self, info: Info, book_id: str) -> list[QuoteCardType]:
        current_user = _require_current_user(info)
        quotes = quote_card_service.list_quotes_by_book(current_user.id, book_id)

        if quotes is None:
            raise GraphQLError("Book not found")

        return [_map_quote(quote) for quote in quotes]


@strawberry.type
class Mutation:
    @strawberry.mutation
    async def create_book(self, info: Info, input: CreateBookInput) -> BookType:
        current_user = _require_current_user(info)

        try:
            created = book_service.create_book(
                current_user.id,
                BookCreate(
                    title=input.title,
                    author=input.author,
                    genre=input.genre,
                    year=input.year,
                    status=input.status,
                    rating=input.rating,
                    cover_url=input.cover_url,
                ),
            )
        except ValidationError as exc:
            raise GraphQLError(_format_validation_error(exc)) from exc

        return _map_book(created)

    @strawberry.mutation
    async def update_book(
        self,
        info: Info,
        id: str,
        input: UpdateBookInput,
    ) -> BookType:
        current_user = _require_current_user(info)

        try:
            updated = book_service.update_book(
                current_user.id,
                id,
                BookUpdate(
                    title=input.title,
                    author=input.author,
                    genre=input.genre,
                    year=input.year,
                    status=input.status,
                    rating=input.rating,
                    cover_url=input.cover_url,
                ),
            )
        except ValidationError as exc:
            raise GraphQLError(_format_validation_error(exc)) from exc

        if updated is None:
            raise GraphQLError("Book not found")

        return _map_book(updated)

    @strawberry.mutation
    async def delete_book(self, info: Info, id: str) -> bool:
        current_user = _require_current_user(info)
        return book_service.delete_book(current_user.id, id)

    @strawberry.mutation
    async def create_quote(self, info: Info, input: CreateQuoteInput) -> QuoteCardType:
        current_user = _require_current_user(info)

        try:
            created = quote_card_service.create_quote(
                current_user.id,
                input.book_id,
                QuoteCardCreate(
                    text=input.text,
                    note=input.note,
                    tag=input.tag,
                ),
            )
        except ValidationError as exc:
            raise GraphQLError(_format_validation_error(exc)) from exc

        if created is None:
            raise GraphQLError("Book not found")

        return _map_quote(created)

    @strawberry.mutation
    async def update_quote(
        self,
        info: Info,
        quote_id: str,
        input: UpdateQuoteInput,
    ) -> QuoteCardType:
        current_user = _require_current_user(info)

        try:
            updated = quote_card_service.update_quote(
                current_user.id,
                quote_id,
                QuoteCardUpdate(
                    text=input.text,
                    note=input.note,
                    tag=input.tag,
                ),
            )
        except ValidationError as exc:
            raise GraphQLError(_format_validation_error(exc)) from exc

        if updated is None:
            raise GraphQLError("Quote not found")

        return _map_quote(updated)

    @strawberry.mutation
    async def delete_quote(self, info: Info, quote_id: str) -> bool:
        current_user = _require_current_user(info)
        return quote_card_service.delete_quote(current_user.id, quote_id)


schema = strawberry.Schema(query=Query, mutation=Mutation)