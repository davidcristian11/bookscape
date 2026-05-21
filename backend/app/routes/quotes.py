from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies import logging_service, quote_card_service
from app.routes.auth import require_authenticated_user
from app.schemas.auth import UserResponse
from app.schemas.quote_card import (
    QuoteCardCreate,
    QuoteCardResponse,
    QuoteCardUpdate,
)

router = APIRouter(tags=["quotes"])


@router.get("/books/{book_id}/quotes", response_model=list[QuoteCardResponse])
@router.get("/books/{book_id}/quote-cards", response_model=list[QuoteCardResponse])
def list_quotes_by_book(
    book_id: str,
    current_user: UserResponse = Depends(require_authenticated_user),
) -> list[QuoteCardResponse]:
    quotes = quote_card_service.list_quotes_by_book(current_user.id, book_id)
    if quotes is None:
        raise HTTPException(status_code=404, detail="Book not found")

    return quotes


@router.post(
    "/books/{book_id}/quotes",
    response_model=QuoteCardResponse,
    status_code=status.HTTP_201_CREATED,
)
@router.post(
    "/books/{book_id}/quote-cards",
    response_model=QuoteCardResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_quote(
    book_id: str,
    payload: QuoteCardCreate,
    current_user: UserResponse = Depends(require_authenticated_user),
) -> QuoteCardResponse:
    created_quote = quote_card_service.create_quote(
        current_user.id,
        book_id,
        payload,
    )
    if created_quote is None:
        raise HTTPException(status_code=404, detail="Book not found")
    logging_service.log_action(
        user_id=current_user.id,
        role_name=current_user.role,
        action="create_quote_card",
        details=f"Created quote card {created_quote.id} for book {book_id}",
    )

    return created_quote


@router.put("/quotes/{quote_id}", response_model=QuoteCardResponse)
@router.put("/quote-cards/{quote_id}", response_model=QuoteCardResponse)
def update_quote(
    quote_id: str,
    payload: QuoteCardUpdate,
    current_user: UserResponse = Depends(require_authenticated_user),
) -> QuoteCardResponse:
    updated_quote = quote_card_service.update_quote(
        current_user.id,
        quote_id,
        payload,
    )
    if updated_quote is None:
        raise HTTPException(status_code=404, detail="Quote not found")
    logging_service.log_action(
        user_id=current_user.id,
        role_name=current_user.role,
        action="update_quote_card",
        details=f"Updated quote card {quote_id}",
    )

    return updated_quote


@router.delete("/quotes/{quote_id}", status_code=status.HTTP_204_NO_CONTENT)
@router.delete("/quote-cards/{quote_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_quote(
    quote_id: str,
    current_user: UserResponse = Depends(require_authenticated_user),
) -> None:
    deleted = quote_card_service.delete_quote(current_user.id, quote_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Quote not found")
    logging_service.log_action(
        user_id=current_user.id,
        role_name=current_user.role,
        action="delete_quote_card",
        details=f"Deleted quote card {quote_id}",
    )
