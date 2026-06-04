from __future__ import annotations

import strawberry
from fastapi import Request
from graphql import GraphQLError
from pydantic import ValidationError
from strawberry.types import Info

from app.dependencies import auth_service, book_service, logging_service, quote_card_service, seed_service
from app.routes.auth import _extract_bearer_token
from app.schemas.auth import AuthResponse, LoginRequest, RegisterRequest, UserResponse
from app.schemas.book import BookCreate, BookResponse, BookUpdate
from app.schemas.quote_card import QuoteCardCreate, QuoteCardResponse, QuoteCardUpdate


def _format_validation_error(exc: ValidationError) -> str:
    return " | ".join(
        f"{'.'.join(str(item) for item in error.get('loc', []))}: {error.get('msg', 'Invalid value')}"
        for error in exc.errors()
    ) or "Validation failed"


def _require_current_user(info: Info) -> UserResponse:
    current_user = info.context.get("current_user")
    if current_user is None:
        raise GraphQLError("Unauthorized")
    return current_user


def _require_permission(info: Info, permission: str) -> UserResponse:
    current_user = _require_current_user(info)
    if permission not in current_user.permissions:
        raise GraphQLError("Forbidden")
    return current_user


@strawberry.type
class BookType:
    id: str
    title: str
    author: str
    genre: str
    publication_year: int
    source: str
    source_url: str | None
    synopsis: str
    review: str
    rating: int
    cover_url: str | None


@strawberry.type
class QuoteCardType:
    id: str
    book_id: str
    quote: str
    note: str | None
    relationship_label: str | None
    position_x: float
    position_y: float


@strawberry.type
class BooksPageType:
    items: list[BookType]
    total: int
    page: int
    page_size: int
    total_pages: int


@strawberry.type
class UserType:
    id: str
    name: str
    email: str
    role: str
    permissions: list[str]


@strawberry.type
class AuthPayloadType:
    token: str
    refresh_token: str | None
    user: UserType


@strawberry.input
class CreateBookInput:
    title: str
    author: str
    genre: str
    publication_year: int
    source: str = "Manual"
    source_url: str | None = None
    synopsis: str = ""
    review: str = ""
    rating: int = 0
    cover_url: str | None = None


@strawberry.input
class UpdateBookInput:
    title: str | None = None
    author: str | None = None
    genre: str | None = None
    publication_year: int | None = None
    source: str | None = None
    source_url: str | None = None
    synopsis: str | None = None
    review: str | None = None
    rating: int | None = None
    cover_url: str | None = None


@strawberry.input
class CreateQuoteInput:
    book_id: str
    quote: str
    note: str | None = None
    relationship_label: str | None = None
    position_x: float = 0
    position_y: float = 0


@strawberry.input
class UpdateQuoteInput:
    quote: str | None = None
    note: str | None = None
    relationship_label: str | None = None
    position_x: float | None = None
    position_y: float | None = None


def _map_book(book: BookResponse) -> BookType:
    return BookType(
        id=book.id,
        title=book.title,
        author=book.author,
        genre=book.genre,
        publication_year=book.publication_year,
        source=book.source,
        source_url=str(book.source_url) if book.source_url else None,
        synopsis=book.synopsis,
        review=book.review,
        rating=book.rating,
        cover_url=str(book.cover_url) if book.cover_url else None,
    )


def _map_quote(quote: QuoteCardResponse) -> QuoteCardType:
    return QuoteCardType(
        id=quote.id,
        book_id=quote.book_id,
        quote=quote.quote,
        note=quote.note,
        relationship_label=quote.relationship_label,
        position_x=quote.position_x,
        position_y=quote.position_y,
    )


def _map_user(user: UserResponse) -> UserType:
    return UserType(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,
        permissions=user.permissions,
    )


def _map_auth(auth: AuthResponse) -> AuthPayloadType:
    return AuthPayloadType(
        token=auth.token,
        refresh_token=auth.refresh_token,
        user=_map_user(auth.user),
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

    return {"request": request, "current_user": current_user}


@strawberry.type
class Query:
    @strawberry.field
    async def books(self, info: Info, page: int = 1, page_size: int = 10) -> BooksPageType:
        current_user = _require_permission(info, "books:read")
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
        current_user = _require_permission(info, "books:read")
        book = book_service.get_book(current_user.id, id)
        return _map_book(book) if book else None

    @strawberry.field
    async def quote_cards_by_book(self, info: Info, book_id: str) -> list[QuoteCardType]:
        current_user = _require_permission(info, "books:read")
        quotes = quote_card_service.list_quotes_by_book(current_user.id, book_id)
        if quotes is None:
            raise GraphQLError("Book not found")
        return [_map_quote(quote) for quote in quotes]

    @strawberry.field
    async def me(self, info: Info) -> UserType:
        current_user = _require_current_user(info)
        return _map_user(current_user)


@strawberry.type
class Mutation:
    @strawberry.mutation
    async def register(self, name: str, email: str, password: str) -> AuthPayloadType:
        try:
            seed_service.seed_auth_defaults()
            auth = auth_service.register(
                RegisterRequest(name=name, email=email, password=password)
            )
            seed_service.seed_user_library(auth.user.id)
        except ValueError as exc:
            raise GraphQLError(str(exc)) from exc
        except ValidationError as exc:
            raise GraphQLError(_format_validation_error(exc)) from exc
        return _map_auth(auth)

    @strawberry.mutation
    async def login(self, email: str, password: str) -> AuthPayloadType:
        try:
            seed_service.seed_auth_defaults()
            auth = auth_service.login(LoginRequest(email=email, password=password))
        except ValueError as exc:
            raise GraphQLError(str(exc)) from exc
        except ValidationError as exc:
            raise GraphQLError(_format_validation_error(exc)) from exc
        return _map_auth(auth)

    @strawberry.mutation
    async def create_book(self, info: Info, input: CreateBookInput) -> BookType:
        current_user = _require_permission(info, "books:write")
        try:
            created = book_service.create_book(current_user.id, BookCreate(**input.__dict__))
        except ValidationError as exc:
            raise GraphQLError(_format_validation_error(exc)) from exc
        logging_service.log_action(
            user_id=current_user.id,
            role_name=current_user.role,
            action="create_book",
            details=f"GraphQL created book {created.id}: {created.title}",
        )
        return _map_book(created)

    @strawberry.mutation
    async def update_book(self, info: Info, id: str, input: UpdateBookInput) -> BookType:
        current_user = _require_permission(info, "books:write")
        try:
            updated = book_service.update_book(current_user.id, id, BookUpdate(**input.__dict__))
        except ValidationError as exc:
            raise GraphQLError(_format_validation_error(exc)) from exc
        if updated is None:
            raise GraphQLError("Book not found")
        logging_service.log_action(
            user_id=current_user.id,
            role_name=current_user.role,
            action="update_book",
            details=f"GraphQL updated book {id}",
        )
        return _map_book(updated)

    @strawberry.mutation
    async def delete_book(self, info: Info, id: str) -> bool:
        current_user = _require_permission(info, "books:delete")
        deleted = book_service.delete_book(current_user.id, id)
        if deleted:
            logging_service.log_action(
                user_id=current_user.id,
                role_name=current_user.role,
                action="delete_book",
                details=f"GraphQL deleted book {id}",
            )
        return deleted

    @strawberry.mutation
    async def create_quote_card(self, info: Info, input: CreateQuoteInput) -> QuoteCardType:
        current_user = _require_permission(info, "quote_cards:write")
        try:
            created = quote_card_service.create_quote(
                current_user.id,
                input.book_id,
                QuoteCardCreate(**input.__dict__),
            )
        except ValidationError as exc:
            raise GraphQLError(_format_validation_error(exc)) from exc
        if created is None:
            raise GraphQLError("Book not found")
        logging_service.log_action(
            user_id=current_user.id,
            role_name=current_user.role,
            action="create_quote_card",
            details=f"GraphQL created quote card {created.id}",
        )
        return _map_quote(created)

    @strawberry.mutation
    async def update_quote_card(self, info: Info, quote_id: str, input: UpdateQuoteInput) -> QuoteCardType:
        current_user = _require_permission(info, "quote_cards:write")
        try:
            updated = quote_card_service.update_quote(current_user.id, quote_id, QuoteCardUpdate(**input.__dict__))
        except ValidationError as exc:
            raise GraphQLError(_format_validation_error(exc)) from exc
        if updated is None:
            raise GraphQLError("Quote not found")
        logging_service.log_action(
            user_id=current_user.id,
            role_name=current_user.role,
            action="update_quote_card",
            details=f"GraphQL updated quote card {quote_id}",
        )
        return _map_quote(updated)

    @strawberry.mutation
    async def delete_quote_card(self, info: Info, quote_id: str) -> bool:
        current_user = _require_permission(info, "quote_cards:write")
        deleted = quote_card_service.delete_quote(current_user.id, quote_id)
        if deleted:
            logging_service.log_action(
                user_id=current_user.id,
                role_name=current_user.role,
                action="delete_quote_card",
                details=f"GraphQL deleted quote card {quote_id}",
            )
        return deleted


schema = strawberry.Schema(query=Query, mutation=Mutation)
