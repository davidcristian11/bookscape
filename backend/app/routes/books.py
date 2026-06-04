from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from app.dependencies import book_service, logging_service, quote_card_service, realtime_service
from app.routes.auth import require_permission
from app.schemas.auth import UserResponse
from app.schemas.book import (
    BookCreate,
    BookResponse,
    BookUpdate,
    PaginatedBooksResponse,
    ScrapeBookRequest,
)
from app.services.scraper_service import ScraperError

router = APIRouter(prefix="/books", tags=["books"])


@router.post("", response_model=BookResponse, status_code=status.HTTP_201_CREATED)
async def create_book(
    payload: BookCreate,
    current_user: UserResponse = Depends(require_permission("books:write")),
) -> BookResponse:
    created_book = book_service.create_book(current_user.id, payload)
    logging_service.log_action(
        user_id=current_user.id,
        role_name=current_user.role,
        action="create_book",
        details=f"Created book {created_book.id}: {created_book.title}",
    )

    await realtime_service.broadcast_to_user(
        current_user.id,
        {
            "type": "book_created",
            "source": "manual",
            "book": created_book.model_dump(mode="json"),
        },
    )

    return created_book


@router.post("/scrape", response_model=BookResponse, status_code=status.HTTP_201_CREATED)
async def scrape_book(
    payload: ScrapeBookRequest,
    current_user: UserResponse = Depends(require_permission("books:write")),
) -> BookResponse:
    try:
        created_book = book_service.scrape_book(current_user.id, payload)
    except ScraperError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    logging_service.log_action(
        user_id=current_user.id,
        role_name=current_user.role,
        action="create_book",
        details=f"Scraped book {created_book.id}: {created_book.title}",
    )

    await realtime_service.broadcast_to_user(
        current_user.id,
        {
            "type": "book_created",
            "source": "scrape",
            "book": created_book.model_dump(mode="json"),
        },
    )

    return created_book


@router.get("", response_model=PaginatedBooksResponse)
async def list_books(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    genre: str | None = Query(None, min_length=1),
    source: str | None = Query(None, min_length=1),
    rating_min: int | None = Query(None, ge=0, le=5),
    rating_max: int | None = Query(None, ge=0, le=5),
    search: str | None = Query(None, min_length=1),
    current_user: UserResponse = Depends(require_permission("books:read")),
) -> PaginatedBooksResponse:
    return book_service.list_books(
        current_user.id,
        page=page,
        page_size=page_size,
        genre=genre,
        source=source,
        rating_min=rating_min,
        rating_max=rating_max,
        search=search,
    )


@router.get("/{book_id}", response_model=BookResponse)
async def get_book(
    book_id: str,
    current_user: UserResponse = Depends(require_permission("books:read")),
) -> BookResponse:
    book = book_service.get_book(current_user.id, book_id)
    if book is None:
        raise HTTPException(status_code=404, detail="Book not found")

    return book


@router.put("/{book_id}", response_model=BookResponse)
async def update_book(
    book_id: str,
    payload: BookUpdate,
    current_user: UserResponse = Depends(require_permission("books:write")),
) -> BookResponse:
    updated_book = book_service.update_book(current_user.id, book_id, payload)
    if updated_book is None:
        raise HTTPException(status_code=404, detail="Book not found")
    logging_service.log_action(
        user_id=current_user.id,
        role_name=current_user.role,
        action="update_book",
        details=f"Updated book {book_id}: {updated_book.title}",
    )

    await realtime_service.broadcast_to_user(
        current_user.id,
        {
            "type": "book_updated",
            "source": "manual",
            "book": updated_book.model_dump(mode="json"),
        },
    )

    return updated_book


@router.delete("/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_book(
    book_id: str,
    current_user: UserResponse = Depends(require_permission("books:delete")),
) -> Response:
    deleted = book_service.delete_book(current_user.id, book_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Book not found")
    logging_service.log_action(
        user_id=current_user.id,
        role_name=current_user.role,
        action="delete_book",
        details=f"Deleted book {book_id}",
    )

    quote_card_service.delete_quotes_for_book(current_user.id, book_id)

    await realtime_service.broadcast_to_user(
        current_user.id,
        {
            "type": "book_deleted",
            "source": "manual",
            "book_id": book_id,
        },
    )

    return Response(status_code=status.HTTP_204_NO_CONTENT)
