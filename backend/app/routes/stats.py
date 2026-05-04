from fastapi import APIRouter, Depends

from app.dependencies import quote_card_service, stats_service
from app.routes.auth import require_authenticated_user
from app.schemas.auth import UserResponse
from app.schemas.book import StatsResponse
from app.schemas.quote_card import QuoteStatsResponse

router = APIRouter(tags=["stats"])


@router.get("/stats", response_model=StatsResponse)
def get_stats(
    current_user: UserResponse = Depends(require_authenticated_user),
) -> StatsResponse:
    return stats_service.get_stats(current_user.id)


@router.get("/stats/quotes", response_model=QuoteStatsResponse)
def get_quote_stats(
    current_user: UserResponse = Depends(require_authenticated_user),
) -> QuoteStatsResponse:
    return quote_card_service.get_quote_stats(current_user.id)