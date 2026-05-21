from sqlalchemy import delete, select

from app.database import session_scope
from app.models.nexus_model import NexusEdge, NexusNode


class NexusRepository:
    def list_nodes(self, user_id: str) -> list[NexusNode]:
        with session_scope() as session:
            return list(
                session.scalars(
                    select(NexusNode).where(NexusNode.user_id == user_id).order_by(NexusNode.id)
                ).all()
            )

    def list_edges(self, user_id: str) -> list[NexusEdge]:
        with session_scope() as session:
            return list(
                session.scalars(
                    select(NexusEdge).where(NexusEdge.user_id == user_id).order_by(NexusEdge.id)
                ).all()
            )

    def get_node(self, node_id: str, user_id: str) -> NexusNode | None:
        with session_scope() as session:
            return session.scalar(
                select(NexusNode).where(NexusNode.id == node_id, NexusNode.user_id == user_id)
            )

    def create_node(self, node: NexusNode) -> NexusNode:
        with session_scope() as session:
            session.add(node)
            session.flush()
            session.refresh(node)
            return node

    def update_node(self, node_id: str, user_id: str, node: NexusNode) -> NexusNode | None:
        with session_scope() as session:
            existing = session.scalar(
                select(NexusNode).where(NexusNode.id == node_id, NexusNode.user_id == user_id)
            )
            if existing is None:
                return None

            existing.book_title = node.book_title
            existing.quote = node.quote
            existing.x = node.x
            existing.y = node.y
            session.flush()
            session.refresh(existing)
            return existing

    def delete_node(self, node_id: str, user_id: str) -> bool:
        with session_scope() as session:
            node = session.scalar(
                select(NexusNode).where(NexusNode.id == node_id, NexusNode.user_id == user_id)
            )
            if node is None:
                return False
            session.delete(node)
            return True

    def create_edge(self, edge: NexusEdge) -> NexusEdge:
        with session_scope() as session:
            session.add(edge)
            session.flush()
            session.refresh(edge)
            return edge

    def delete_edge(self, edge_id: str, user_id: str) -> bool:
        with session_scope() as session:
            edge = session.scalar(
                select(NexusEdge).where(NexusEdge.id == edge_id, NexusEdge.user_id == user_id)
            )
            if edge is None:
                return False
            session.delete(edge)
            return True

    def find_edge_between(self, user_id: str, source_id: str, target_id: str) -> NexusEdge | None:
        with session_scope() as session:
            return session.scalar(
                select(NexusEdge).where(
                    NexusEdge.user_id == user_id,
                    NexusEdge.source_id == source_id,
                    NexusEdge.target_id == target_id,
                )
            )

    def clear(self) -> None:
        with session_scope() as session:
            session.execute(delete(NexusEdge))
            session.execute(delete(NexusNode))
