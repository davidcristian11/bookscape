from fastapi import APIRouter, Depends, Query

from app.dependencies import logging_service
from app.routes.auth import require_admin_user
from app.schemas.admin import LogEntryResponse, ObservationListEntryResponse
from app.schemas.auth import UserResponse

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/logs", response_model=list[LogEntryResponse])
def list_logs(
    limit: int = Query(100, ge=1, le=500),
    current_user: UserResponse = Depends(require_admin_user),
) -> list[LogEntryResponse]:
    logging_service.log_action(
        user_id=current_user.id,
        role_name=current_user.role,
        action="view_logs",
        details="Viewed admin logs",
    )
    return logging_service.list_logs(limit)


@router.get("/observation-list", response_model=list[ObservationListEntryResponse])
def list_observation_entries(
    current_user: UserResponse = Depends(require_admin_user),
) -> list[ObservationListEntryResponse]:
    logging_service.log_action(
        user_id=current_user.id,
        role_name=current_user.role,
        action="view_observation_list",
        details="Viewed observation list",
    )
    return logging_service.list_observations()
