import asyncio
import contextlib
from collections import defaultdict

from fastapi import WebSocket


class RealtimeService:
    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = defaultdict(set)
        self._server_loop: asyncio.AbstractEventLoop | None = None

    async def connect(self, user_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections[user_id].add(websocket)

        if self._server_loop is None or self._server_loop.is_closed():
            self._server_loop = asyncio.get_running_loop()

    def disconnect(self, user_id: str, websocket: WebSocket) -> None:
        if user_id in self._connections:
            self._connections[user_id].discard(websocket)

            if not self._connections[user_id]:
                self._connections.pop(user_id, None)

    async def broadcast_to_user(self, user_id: str, payload: dict) -> None:
        if user_id not in self._connections:
            return

        dead_connections: list[WebSocket] = []

        for websocket in list(self._connections[user_id]):
            try:
                await websocket.send_json(payload)
            except Exception:
                dead_connections.append(websocket)

        for websocket in dead_connections:
            self.disconnect(user_id, websocket)

    def broadcast_to_user_from_thread(self, user_id: str, payload: dict) -> None:
        if self._server_loop is None or self._server_loop.is_closed():
            return

        future = asyncio.run_coroutine_threadsafe(
            self.broadcast_to_user(user_id, payload),
            self._server_loop,
        )

        with contextlib.suppress(Exception):
            future.result(timeout=2)