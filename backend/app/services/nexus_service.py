from uuid import uuid4

from app.models.nexus_model import NexusEdge, NexusNode
from app.repositories.nexus_repository import NexusRepository
from app.schemas.nexus import (
    NexusEdgeCreate,
    NexusEdgeResponse,
    NexusGraphResponse,
    NexusNodeCreate,
    NexusNodeResponse,
    NexusNodeUpdate,
)


class NexusService:
    def __init__(self, repository: NexusRepository) -> None:
        self.repository = repository

    def get_graph(self, user_id: str) -> NexusGraphResponse:
        nodes = self.repository.list_nodes(user_id)
        edges = self.repository.list_edges(user_id)

        return NexusGraphResponse(
            nodes=[NexusNodeResponse.model_validate(node) for node in nodes],
            edges=[NexusEdgeResponse.model_validate(edge) for edge in edges],
        )

    def create_node(self, user_id: str, payload: NexusNodeCreate) -> NexusNodeResponse:
        node = NexusNode(
            user_id=user_id,
            id=str(uuid4()),
            book_title=payload.book_title,
            quote=payload.quote,
            x=payload.x,
            y=payload.y,
        )

        created = self.repository.create_node(node)
        return NexusNodeResponse.model_validate(created)

    def update_node(
        self,
        user_id: str,
        node_id: str,
        payload: NexusNodeUpdate,
    ) -> NexusNodeResponse | None:
        existing = self.repository.get_node(node_id, user_id)
        if existing is None:
            return None

        updated = NexusNode(
            user_id=existing.user_id,
            id=existing.id,
            book_title=payload.book_title if payload.book_title is not None else existing.book_title,
            quote=payload.quote if payload.quote is not None else existing.quote,
            x=payload.x if payload.x is not None else existing.x,
            y=payload.y if payload.y is not None else existing.y,
        )

        saved = self.repository.update_node(node_id, user_id, updated)
        if saved is None:
            return None

        return NexusNodeResponse.model_validate(saved)

    def delete_node(self, user_id: str, node_id: str) -> bool:
        return self.repository.delete_node(node_id, user_id)

    def create_edge(self, user_id: str, payload: NexusEdgeCreate) -> NexusEdgeResponse:
        if payload.source_id == payload.target_id:
            raise ValueError("A node cannot connect to itself")

        source_node = self.repository.get_node(payload.source_id, user_id)
        target_node = self.repository.get_node(payload.target_id, user_id)

        if source_node is None or target_node is None:
            raise ValueError("Source or target node does not exist")

        existing_edge = self.repository.find_edge_between(
            user_id,
            payload.source_id,
            payload.target_id,
        )
        if existing_edge is not None:
            raise ValueError("This connection already exists")

        edge = NexusEdge(
            user_id=user_id,
            id=str(uuid4()),
            source_id=payload.source_id,
            target_id=payload.target_id,
            label=payload.label,
        )

        created = self.repository.create_edge(edge)
        return NexusEdgeResponse.model_validate(created)

    def delete_edge(self, user_id: str, edge_id: str) -> bool:
        return self.repository.delete_edge(edge_id, user_id)