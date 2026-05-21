import pytest
from fastapi.testclient import TestClient

from app.dependencies import (
    book_repository,
    chat_service,
    quote_card_repository,
    seed_service,
    session_repository,
    user_repository,
)
from app.main import app
from app.repositories.book_repository import BookRepository

client = TestClient(app)


@pytest.fixture(autouse=True)
def clear_database_state():
    user_repository.clear()
    session_repository.clear()
    book_repository.clear()
    quote_card_repository.clear()
    chat_service.clear_memory()
    yield
    user_repository.clear()
    session_repository.clear()
    book_repository.clear()
    quote_card_repository.clear()
    chat_service.clear_memory()


def register_headers(email: str = "reader@example.com") -> dict[str, str]:
    response = client.post(
        "/auth/register",
        json={"name": "Reader", "email": email, "password": "secret123"},
    )
    assert response.status_code == 201
    book_repository.clear()
    quote_card_repository.clear()
    return {"Authorization": f"Bearer {response.json()['token']}"}


def book_payload(title: str, genre: str = "Sci-Fi", rating: int = 5) -> dict:
    return {
        "title": title,
        "author": "Author",
        "genre": genre,
        "publication_year": 2024,
        "source": "Manual",
        "source_url": None,
        "synopsis": "Persistent book.",
        "review": "",
        "rating": rating,
        "cover_url": None,
    }


def test_book_filters_and_repository_persistence_use_database():
    headers = register_headers()
    dune = client.post("/books", json=book_payload("Dune", "Sci-Fi", 5), headers=headers).json()
    client.post("/books", json=book_payload("Emma", "Classic", 4), headers=headers)

    filtered = client.get("/books?genre=Sci-Fi&page=1&page_size=10", headers=headers)
    assert filtered.status_code == 200
    assert filtered.json()["total"] == 1
    assert filtered.json()["items"][0]["title"] == "Dune"

    searched = client.get("/books?search=emm&page=1&page_size=10", headers=headers)
    assert searched.json()["total"] == 1
    assert searched.json()["items"][0]["title"] == "Emma"

    persisted = BookRepository().get_by_id(dune["id"], user_id=client.get("/auth/me", headers=headers).json()["id"])
    assert persisted is not None
    assert persisted.title == "Dune"


def test_seeded_roles_admin_restriction_and_observation_detection():
    reader_headers = register_headers("reader@example.com")

    for _ in range(3):
        response = client.post(
            "/auth/login",
            json={"email": "reader@example.com", "password": "wrongpass"},
        )
        assert response.status_code == 401

    forbidden = client.get("/admin/observation-list", headers=reader_headers)
    assert forbidden.status_code == 403

    seed_service.seed_auth_defaults()
    admin_login = client.post(
        "/auth/login",
        json={"email": "admin@bookscape.test", "password": "admin123"},
    )
    assert admin_login.status_code == 200
    admin_data = admin_login.json()
    assert admin_data["user"]["is_admin"] is True

    admin_headers = {"Authorization": f"Bearer {admin_data['token']}"}
    observations = client.get("/admin/observation-list", headers=admin_headers)
    assert observations.status_code == 200
    reasons = [entry["reason"] for entry in observations.json()]
    assert "Repeated failed login attempts" in reasons


def test_chat_persists_messages_and_websocket_broadcasts_between_users():
    headers_one = register_headers("one@example.com")
    token_one = headers_one["Authorization"].replace("Bearer ", "")
    headers_two = register_headers("two@example.com")
    token_two = headers_two["Authorization"].replace("Bearer ", "")

    with client.websocket_connect(f"/ws/chat?token={token_one}") as ws_one:
        with client.websocket_connect(f"/ws/chat?token={token_two}") as ws_two:
            assert ws_one.receive_json()["type"] == "chat_connected"
            assert ws_two.receive_json()["type"] == "chat_connected"

            ws_one.send_text("Hello from one")
            messages = [ws_one.receive_json(), ws_two.receive_json()]
            assert all(message["type"] == "chat_message" for message in messages)
            assert {message["message"]["message"] for message in messages} == {"Hello from one"}

    persisted = client.get("/chat/messages", headers=headers_two)
    assert persisted.status_code == 200
    assert persisted.json()[-1]["message"] == "Hello from one"
