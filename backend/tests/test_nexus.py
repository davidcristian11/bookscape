import pytest
from fastapi.testclient import TestClient

from app.dependencies import nexus_repository, session_repository, user_repository
from app.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_repositories():
    user_repository.clear()
    session_repository.clear()
    nexus_repository.clear()
    yield
    user_repository.clear()
    session_repository.clear()
    nexus_repository.clear()


def register_and_get_headers(
    name: str = "Cristian",
    email: str = "cristian@example.com",
    password: str = "secret123",
) -> dict[str, str]:
    response = client.post(
        "/auth/register",
        json={
            "name": name,
            "email": email,
            "password": password,
        },
    )

    assert response.status_code == 201
    token = response.json()["token"]
    return {"Authorization": f"Bearer {token}"}


def test_get_empty_graph():
    headers = register_and_get_headers()

    response = client.get("/nexus", headers=headers)

    assert response.status_code == 200
    data = response.json()
    assert data["nodes"] == []
    assert data["edges"] == []


def test_create_node():
    headers = register_and_get_headers()

    response = client.post(
        "/nexus/nodes",
        json={
            "book_title": "Dune",
            "quote": "Fear is the mind-killer.",
            "x": 120,
            "y": 300,
        },
        headers=headers,
    )

    assert response.status_code == 201
    data = response.json()
    assert data["book_title"] == "Dune"
    assert data["quote"] == "Fear is the mind-killer."


def test_update_node():
    headers = register_and_get_headers()

    create_response = client.post(
        "/nexus/nodes",
        json={
            "book_title": "Dune",
            "quote": "Fear is the mind-killer.",
            "x": 120,
            "y": 300,
        },
        headers=headers,
    )
    node_id = create_response.json()["id"]

    update_response = client.put(
        f"/nexus/nodes/{node_id}",
        json={
            "x": 400,
            "y": 500,
        },
        headers=headers,
    )

    assert update_response.status_code == 200
    data = update_response.json()
    assert data["x"] == 400
    assert data["y"] == 500


def test_create_edge():
    headers = register_and_get_headers()

    source_response = client.post(
        "/nexus/nodes",
        json={
            "book_title": "Book A",
            "quote": "Quote A",
            "x": 0,
            "y": 0,
        },
        headers=headers,
    )
    target_response = client.post(
        "/nexus/nodes",
        json={
            "book_title": "Book B",
            "quote": "Quote B",
            "x": 100,
            "y": 100,
        },
        headers=headers,
    )

    response = client.post(
        "/nexus/edges",
        json={
            "source_id": source_response.json()["id"],
            "target_id": target_response.json()["id"],
            "label": "Related",
        },
        headers=headers,
    )

    assert response.status_code == 201
    data = response.json()
    assert data["label"] == "Related"


def test_delete_node_removes_connected_edges():
    headers = register_and_get_headers()

    source_response = client.post(
        "/nexus/nodes",
        json={
            "book_title": "Book A",
            "quote": "Quote A",
            "x": 0,
            "y": 0,
        },
        headers=headers,
    )
    target_response = client.post(
        "/nexus/nodes",
        json={
            "book_title": "Book B",
            "quote": "Quote B",
            "x": 100,
            "y": 100,
        },
        headers=headers,
    )

    client.post(
        "/nexus/edges",
        json={
            "source_id": source_response.json()["id"],
            "target_id": target_response.json()["id"],
            "label": "Related",
        },
        headers=headers,
    )

    delete_response = client.delete(
        f"/nexus/nodes/{source_response.json()['id']}",
        headers=headers,
    )
    assert delete_response.status_code == 204

    graph_response = client.get("/nexus", headers=headers)
    data = graph_response.json()

    assert len(data["nodes"]) == 1
    assert len(data["edges"]) == 0


def test_nexus_requires_authentication():
    response = client.get("/nexus")

    assert response.status_code == 401


def test_nexus_is_user_specific():
    headers_user_1 = register_and_get_headers(
        name="Cristian",
        email="cristian1@example.com",
    )
    headers_user_2 = register_and_get_headers(
        name="Maria",
        email="maria@example.com",
    )

    client.post(
        "/nexus/nodes",
        json={
            "book_title": "Cristian Book",
            "quote": "Cristian Quote",
            "x": 10,
            "y": 20,
        },
        headers=headers_user_1,
    )

    response_user_1 = client.get("/nexus", headers=headers_user_1)
    response_user_2 = client.get("/nexus", headers=headers_user_2)

    assert response_user_1.status_code == 200
    assert response_user_2.status_code == 200

    data_user_1 = response_user_1.json()
    data_user_2 = response_user_2.json()

    assert len(data_user_1["nodes"]) == 1
    assert data_user_1["nodes"][0]["book_title"] == "Cristian Book"

    assert len(data_user_2["nodes"]) == 0
    assert len(data_user_2["edges"]) == 0