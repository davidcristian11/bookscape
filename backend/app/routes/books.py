from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from app.dependencies import book_service, realtime_service
from app.routes.auth import require_authenticated_user
from app.schemas.auth import UserResponse
from app.schemas.book import BookCreate, BookResponse, BookUpdate, PaginatedBooksResponse

router = APIRouter(prefix="/books", tags=["books"])


@router.post("", response_model=BookResponse, status_code=status.HTTP_201_CREATED)
async def create_book(
    payload: BookCreate,
    current_user: UserResponse = Depends(require_authenticated_user),
) -> BookResponse:
    created_book = book_service.create_book(current_user.id, payload)

    await realtime_service.broadcast_to_user(
        current_user.id,
        {
            "type": "book_created",
            "source": "manual",
            "book": created_book.model_dump(),
        },
    )

    return created_book


@router.get("", response_model=PaginatedBooksResponse)
async def list_books(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    current_user: UserResponse = Depends(require_authenticated_user),
) -> PaginatedBooksResponse:
    return book_service.list_books(current_user.id, page=page, page_size=page_size)


@router.get("/{book_id}", response_model=BookResponse)
async def get_book(
    book_id: str,
    current_user: UserResponse = Depends(require_authenticated_user),
) -> BookResponse:
    book = book_service.get_book(current_user.id, book_id)
    if book is None:
        raise HTTPException(status_code=404, detail="Book not found")

    return book


@router.put("/{book_id}", response_model=BookResponse)
async def update_book(
    book_id: str,
    payload: BookUpdate,
    current_user: UserResponse = Depends(require_authenticated_user),
) -> BookResponse:
    updated_book = book_service.update_book(current_user.id, book_id, payload)
    if updated_book is None:
        raise HTTPException(status_code=404, detail="Book not found")

    await realtime_service.broadcast_to_user(
        current_user.id,
        {
            "type": "book_updated",
            "source": "manual",
            "book": updated_book.model_dump(),
        },
    )

    return updated_book


@router.delete("/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_book(
    book_id: str,
    current_user: UserResponse = Depends(require_authenticated_user),
) -> Response:
    deleted = book_service.delete_book(current_user.id, book_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Book not found")

    await realtime_service.broadcast_to_user(
        current_user.id,
        {
            "type": "book_deleted",
            "source": "manual",
            "book_id": book_id,
        },
    )

    return Response(status_code=status.HTTP_204_NO_CONTENT)