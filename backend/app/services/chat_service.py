from datetime import datetime, timezone
from uuid import uuid4

from fastapi import WebSocket

from app.core.config import get_settings
from app.schemas.auth import UserResponse
from app.schemas.chat import ChatMessageResponse


class ChatService:
    def __init__(self) -> None:
        settings = get_settings()
        self.mongodb_url = settings.mongodb_url
        self.mongodb_db = settings.mongodb_db
        self._client = None
        self._collection = None
        self._memory_messages: list[dict] = []
        self._connections: set[WebSocket] = set()

    async def connect_storage(self) -> None:
        if self.mongodb_url.startswith("memory://") or self._collection is not None:
            return

        try:
            from motor.motor_asyncio import AsyncIOMotorClient
        except ImportError:
            return

        self._client = AsyncIOMotorClient(self.mongodb_url)
        database = self._client[self.mongodb_db]
        self._collection = database["messages"]
        await self._collection.create_index("created_at")

    async def close_storage(self) -> None:
        if self._client is not None:
            self._client.close()
        self._client = None
        self._collection = None

    def _now(self) -> datetime:
        return datetime.now(timezone.utc)

    def _map_message(self, document: dict) -> ChatMessageResponse:
        return ChatMessageResponse(
            id=document["id"],
            user_id=document["user_id"],
            user_name=document["user_name"],
            role_name=document["role_name"],
            message=document["message"],
            created_at=document["created_at"],
        )

    async def list_messages(self, limit: int = 50) -> list[ChatMessageResponse]:
        await self.connect_storage()

        if self._collection is None:
            documents = sorted(self._memory_messages, key=lambda item: item["created_at"])
            return [self._map_message(document) for document in documents[-limit:]]

        cursor = self._collection.find({}).sort("created_at", -1).limit(limit)
        documents = await cursor.to_list(length=limit)
        documents.reverse()
        return [self._map_message(document) for document in documents]

    async def save_message(self, user: UserResponse, message: str) -> ChatMessageResponse:
        await self.connect_storage()

        document = {
            "id": str(uuid4()),
            "user_id": user.id,
            "user_name": user.name,
            "role_name": user.role,
            "message": message,
            "created_at": self._now(),
        }

        if self._collection is None:
            self._memory_messages.append(document)
        else:
            await self._collection.insert_one(document)

        return self._map_message(document)

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections.add(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        self._connections.discard(websocket)

    async def broadcast(self, message: ChatMessageResponse) -> None:
        payload = {
            "type": "chat_message",
            "message": message.model_dump(mode="json"),
        }
        dead_connections: list[WebSocket] = []
        for websocket in list(self._connections):
            try:
                await websocket.send_json(payload)
            except Exception:
                dead_connections.append(websocket)

        for websocket in dead_connections:
            self.disconnect(websocket)

    def clear_memory(self) -> None:
        self._memory_messages.clear()
