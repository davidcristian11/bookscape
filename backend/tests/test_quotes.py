import pytest
from fastapi.testclient import TestClient

from app.dependencies import book_repository, quote_card_repository, session_repository, user_repository
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


def register_headers() -> dict[str, str]:
    response = client.post(
        "/auth/register",
        json={"name": "Reader", "email": "reader@example.com", "password": "secret123"},
    )
    assert response.status_code == 201
    book_repository.clear()
    quote_card_repository.clear()
    return {"Authorization": f"Bearer {response.json()['token']}"}


def create_book(headers: dict[str, str]) -> dict:
    response = client.post(
        "/books",
        json={
            "title": "Dune",
            "author": "Frank Herbert",
            "genre": "Sci-Fi",
            "publication_year": 1965,
            "source": "Manual",
            "synopsis": "A test book.",
            "review": "",
            "rating": 5,
            "cover_url": None,
            "source_url": None,
        },
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()


def test_quote_card_crud_and_book_relationship():
    headers = register_headers()
    book = create_book(headers)

    create_response = client.post(
        f"/books/{book['id']}/quote-cards",
        json={
            "quote": "Fear is the mind-killer.",
            "note": "Theme marker",
            "relationship_label": "Resilience",
            "position_x": 120,
            "position_y": 240,
        },
        headers=headers,
    )
    assert create_response.status_code == 201
    quote = create_response.json()
    assert quote["book_id"] == book["id"]
    assert quote["quote"] == "Fear is the mind-killer."

    list_response = client.get(f"/books/{book['id']}/quote-cards", headers=headers)
    assert list_response.status_code == 200
    assert [item["id"] for item in list_response.json()] == [quote["id"]]

    update_response = client.put(
        f"/quote-cards/{quote['id']}",
        json={"relationship_label": "Change", "position_x": 300},
        headers=headers,
    )
    assert update_response.status_code == 200
    assert update_response.json()["relationship_label"] == "Change"
    assert update_response.json()["position_x"] == 300

    delete_response = client.delete(f"/quote-cards/{quote['id']}", headers=headers)
    assert delete_response.status_code == 204
    assert client.get(f"/books/{book['id']}/quote-cards", headers=headers).json() == []


def test_deleting_book_deletes_quote_cards():
    headers = register_headers()
    book = create_book(headers)
    quote = client.post(
        f"/books/{book['id']}/quote-cards",
        json={"quote": "A quote", "relationship_label": "Identity"},
        headers=headers,
    ).json()

    assert client.delete(f"/books/{book['id']}", headers=headers).status_code == 204
    assert client.put(
        f"/quote-cards/{quote['id']}",
        json={"note": "Should not exist"},
        headers=headers,
    ).status_code == 404


def test_quote_stats_use_relationship_labels_and_book_titles():
    headers = register_headers()
    book = create_book(headers)
    for label in ["Identity", "Identity", "Regret"]:
        client.post(
            f"/books/{book['id']}/quote-cards",
            json={"quote": f"{label} quote", "relationship_label": label},
            headers=headers,
        )

    stats = client.get("/stats/quotes", headers=headers).json()
    assert stats["total_quotes"] == 3
    assert stats["quotes_by_book"]["Dune"] == 3
    assert stats["quotes_by_relationship"]["Identity"] == 2
    assert stats["quotes_by_relationship"]["Regret"] == 1
