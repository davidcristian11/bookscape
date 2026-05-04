from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies import nexus_service
from app.routes.auth import require_authenticated_user
from app.schemas.auth import UserResponse
from app.schemas.nexus import (
    NexusEdgeCreate,
    NexusEdgeResponse,
    NexusGraphResponse,
    NexusNodeCreate,
    NexusNodeResponse,
    NexusNodeUpdate,
)

router = APIRouter(prefix="/nexus", tags=["nexus"])


@router.get("", response_model=NexusGraphResponse)
def get_graph(
    current_user: UserResponse = Depends(require_authenticated_user),
) -> NexusGraphResponse:
    return nexus_service.get_graph(current_user.id)


@router.post(
    "/nodes",
    response_model=NexusNodeResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_node(
    payload: NexusNodeCreate,
    current_user: UserResponse = Depends(require_authenticated_user),
) -> NexusNodeResponse:
    return nexus_service.create_node(current_user.id, payload)


@router.put("/nodes/{node_id}", response_model=NexusNodeResponse)
def update_node(
    node_id: str,
    payload: NexusNodeUpdate,
    current_user: UserResponse = Depends(require_authenticated_user),
) -> NexusNodeResponse:
    updated = nexus_service.update_node(current_user.id, node_id, payload)
    if updated is None:
        raise HTTPException(status_code=404, detail="Node not found")

    return updated


@router.delete("/nodes/{node_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_node(
    node_id: str,
    current_user: UserResponse = Depends(require_authenticated_user),
) -> None:
    deleted = nexus_service.delete_node(current_user.id, node_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Node not found")


@router.post(
    "/edges",
    response_model=NexusEdgeResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_edge(
    payload: NexusEdgeCreate,
    current_user: UserResponse = Depends(require_authenticated_user),
) -> NexusEdgeResponse:
    try:
        return nexus_service.create_edge(current_user.id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/edges/{edge_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_edge(
    edge_id: str,
    current_user: UserResponse = Depends(require_authenticated_user),
) -> None:
    deleted = nexus_service.delete_edge(current_user.id, edge_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Edge not found")