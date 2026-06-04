from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.dependencies import auth_service, realtime_service

router = APIRouter(tags=["realtime"])


@router.websocket("/ws/books")
async def books_websocket(websocket: WebSocket) -> None:
    token = websocket.query_params.get("token")

    if not token:
        await websocket.close(code=4401, reason="Missing token")
        return

    current_user = auth_service.get_current_user(token)
    if current_user is None or "books:read" not in current_user.permissions:
        await websocket.close(code=4401, reason="Invalid or expired session")
        return

    await realtime_service.connect(current_user.id, websocket)

    try:
        await websocket.send_json(
            {
                "type": "ws_connected",
                "message": "Realtime updates connected",
            }
        )

        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        realtime_service.disconnect(current_user.id, websocket)
    except Exception:
        realtime_service.disconnect(current_user.id, websocket)
