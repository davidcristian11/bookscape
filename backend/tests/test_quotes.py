import pytest
from fastapi.testclient import TestClient

from app.dependencies import (
    book_repository,
    quote_card_repository,
    session_repository,
    user_repository,
)
from app.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def clear_repositories():
    user_repository.clear()
    session_repository.clear()
    book_repository.clear()
    quote_card_repository.clear()
    yield
    user_repository.clear()
    session_repository.clear()
    book_repository.clear()
    quote_card_repository.clear()


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


def create_book(headers: dict[str, str], title: str = "Dune") -> dict:
    response = client.post(
        "/books",
        json={
            "title": title,
            "author": "Frank Herbert",
            "genre": "Sci-Fi",
            "year": 1965,
            "status": "to-read",
            "rating": 5,
            "cover_url": None,
        },
        headers=headers,
    )

    assert response.status_code == 201
    return response.json()


def test_create_and_list_quotes_for_book():
    headers = register_and_get_headers()
    book = create_book(headers)

    create_response = client.post(
        f"/books/{book['id']}/quotes",
        json={
            "text": "Fear is the mind-killer.",
            "note": "Important line",
            "tag": "theme",
        },
        headers=headers,
    )

    assert create_response.status_code == 201
    created_quote = create_response.json()
    assert created_quote["book_id"] == book["id"]
    assert created_quote["text"] == "Fear is the mind-killer."

    list_response = client.get(
        f"/books/{book['id']}/quotes",
        headers=headers,
    )

    assert list_response.status_code == 200
    quotes = list_response.json()
    assert len(quotes) == 1
    assert quotes[0]["id"] == created_quote["id"]


def test_update_quote():
    headers = register_and_get_headers()
    book = create_book(headers)

    create_response = client.post(
        f"/books/{book['id']}/quotes",
        json={
            "text": "Fear is the mind-killer.",
            "note": None,
            "tag": "theme",
        },
        headers=headers,
    )
    quote_id = create_response.json()["id"]

    update_response = client.put(
        f"/quotes/{quote_id}",
        json={
            "text": "Fear is the little-death that brings total obliteration.",
            "note": "Updated note",
        },
        headers=headers,
    )

    assert update_response.status_code == 200
    updated_quote = update_response.json()
    assert updated_quote["text"] == "Fear is the little-death that brings total obliteration."
    assert updated_quote["note"] == "Updated note"
    assert updated_quote["tag"] == "theme"


def test_delete_quote():
    headers = register_and_get_headers()
    book = create_book(headers)

    create_response = client.post(
        f"/books/{book['id']}/quotes",
        json={
            "text": "Fear is the mind-killer.",
        },
        headers=headers,
    )
    quote_id = create_response.json()["id"]

    delete_response = client.delete(
        f"/quotes/{quote_id}",
        headers=headers,
    )

    assert delete_response.status_code == 204

    list_response = client.get(
        f"/books/{book['id']}/quotes",
        headers=headers,
    )

    assert list_response.status_code == 200
    assert list_response.json() == []


def test_quote_stats():
    headers = register_and_get_headers()
    book_one = create_book(headers, title="Dune")
    book_two = create_book(headers, title="1984")

    client.post(
        f"/books/{book_one['id']}/quotes",
        json={
            "text": "Fear is the mind-killer.",
            "tag": "theme",
        },
        headers=headers,
    )
    client.post(
        f"/books/{book_one['id']}/quotes",
        json={
            "text": "A beginning is the time for taking the most delicate care.",
            "tag": "opening",
        },
        headers=headers,
    )
    client.post(
        f"/books/{book_two['id']}/quotes",
        json={
            "text": "War is peace. Freedom is slavery. Ignorance is strength.",
            "tag": "theme",
        },
        headers=headers,
    )

    stats_response = client.get("/stats/quotes", headers=headers)

    assert stats_response.status_code == 200
    data = stats_response.json()
    assert data["total_quotes"] == 3
    assert data["quotes_by_book"][book_one["id"]] == 2
    assert data["quotes_by_book"][book_two["id"]] == 1
    assert data["quotes_by_tag"]["theme"] == 2
    assert data["quotes_by_tag"]["opening"] == 1