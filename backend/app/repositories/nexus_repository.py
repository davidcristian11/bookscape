from app.models.nexus_model import NexusEdge, NexusNode


class NexusRepository:
    def __init__(self) -> None:
        self._nodes: dict[str, NexusNode] = {}
        self._edges: dict[str, NexusEdge] = {}

    def list_nodes(self, user_id: str) -> list[NexusNode]:
        return [node for node in self._nodes.values() if node.user_id == user_id]

    def list_edges(self, user_id: str) -> list[NexusEdge]:
        return [edge for edge in self._edges.values() if edge.user_id == user_id]

    def get_node(self, node_id: str, user_id: str) -> NexusNode | None:
        node = self._nodes.get(node_id)
        if node is None or node.user_id != user_id:
            return None
        return node

    def create_node(self, node: NexusNode) -> NexusNode:
        self._nodes[node.id] = node
        return node

    def update_node(self, node_id: str, user_id: str, node: NexusNode) -> NexusNode | None:
        existing = self._nodes.get(node_id)
        if existing is None or existing.user_id != user_id:
            return None

        self._nodes[node_id] = node
        return node

    def delete_node(self, node_id: str, user_id: str) -> bool:
        node = self._nodes.get(node_id)
        if node is None or node.user_id != user_id:
            return False

        self._nodes.pop(node_id, None)

        edge_ids_to_remove = [
            edge_id
            for edge_id, edge in self._edges.items()
            if edge.user_id == user_id and (edge.source_id == node_id or edge.target_id == node_id)
        ]

        for edge_id in edge_ids_to_remove:
            self._edges.pop(edge_id, None)

        return True

    def create_edge(self, edge: NexusEdge) -> NexusEdge:
        self._edges[edge.id] = edge
        return edge

    def delete_edge(self, edge_id: str, user_id: str) -> bool:
        edge = self._edges.get(edge_id)
        if edge is None or edge.user_id != user_id:
            return False

        self._edges.pop(edge_id, None)
        return True

    def find_edge_between(self, user_id: str, source_id: str, target_id: str) -> NexusEdge | None:
        for edge in self._edges.values():
            if (
                edge.user_id == user_id
                and edge.source_id == source_id
                and edge.target_id == target_id
            ):
                return edge
        return None

    def clear(self) -> None:
        self._nodes.clear()
        self._edges.clear()