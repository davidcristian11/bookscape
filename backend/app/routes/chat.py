from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect, status
from pydantic import ValidationError

from app.dependencies import auth_service, chat_service, logging_service
from app.routes.auth import require_permission
from app.schemas.auth import UserResponse
from app.schemas.chat import ChatMessageCreate, ChatMessageResponse

router = APIRouter(tags=["chat"])


@router.get("/chat/messages", response_model=list[ChatMessageResponse])
async def list_chat_messages(
    limit: int = Query(50, ge=1, le=200),
    current_user: UserResponse = Depends(require_permission("chat:read")),
) -> list[ChatMessageResponse]:
    return await chat_service.list_messages(limit)


@router.post("/chat/messages", response_model=ChatMessageResponse, status_code=status.HTTP_201_CREATED)
async def create_chat_message(
    payload: ChatMessageCreate,
    current_user: UserResponse = Depends(require_permission("chat:write")),
) -> ChatMessageResponse:
    saved = await chat_service.save_message(current_user, payload.message)
    logging_service.log_action(
        user_id=current_user.id,
        role_name=current_user.role,
        action="chat_message",
        details="Sent chat message",
    )
    await chat_service.broadcast(saved)
    return saved


@router.websocket("/ws/chat")
async def chat_websocket(websocket: WebSocket) -> None:
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4401, reason="Missing token")
        return

    current_user = auth_service.get_current_user(token)
    if current_user is None or "chat:write" not in current_user.permissions:
        await websocket.close(code=4401, reason="Invalid or expired session")
        return

    await chat_service.connect(websocket)
    try:
        await websocket.send_json({"type": "chat_connected"})
        while True:
            raw_message = await websocket.receive_text()
            try:
                payload = ChatMessageCreate(message=raw_message)
            except ValidationError as exc:
                await websocket.send_json(
                    {
                        "type": "chat_error",
                        "message": exc.errors()[0]["msg"] if exc.errors() else "Invalid message",
                    }
                )
                continue

            saved = await chat_service.save_message(current_user, payload.message)
            logging_service.log_action(
                user_id=current_user.id,
                role_name=current_user.role,
                action="chat_message",
                details="Sent chat message over WebSocket",
            )
            await chat_service.broadcast(saved)
    except WebSocketDisconnect:
        chat_service.disconnect(websocket)
    except Exception:
        chat_service.disconnect(websocket)
        raise
