from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies import faker_automation_service
from app.routes.auth import require_permission
from app.schemas.auth import UserResponse
from app.schemas.automation import FakerLoopStartRequest, FakerLoopStatusResponse

router = APIRouter(prefix="/automation", tags=["automation"])


@router.get("/faker/status", response_model=FakerLoopStatusResponse)
async def get_faker_loop_status(
    current_user: UserResponse = Depends(require_permission("automation:write")),
) -> FakerLoopStatusResponse:
    return faker_automation_service.get_status(current_user.id)


@router.post("/faker/start", response_model=FakerLoopStatusResponse)
async def start_faker_loop(
    payload: FakerLoopStartRequest,
    current_user: UserResponse = Depends(require_permission("automation:write")),
) -> FakerLoopStatusResponse:
    try:
        return await faker_automation_service.start(
            current_user.id,
            payload.interval_seconds,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc


@router.post("/faker/stop", response_model=FakerLoopStatusResponse)
async def stop_faker_loop(
    current_user: UserResponse = Depends(require_permission("automation:write")),
) -> FakerLoopStatusResponse:
    return await faker_automation_service.stop(current_user.id)
