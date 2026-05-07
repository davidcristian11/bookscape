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


def create_book(headers: dict[str, str], title: str, genre: str, source: str, rating: int) -> dict:
    response = client.post(
        "/books",
        json={
            "title": title,
            "author": "Author",
            "genre": genre,
            "publication_year": 2020,
            "source": source,
            "source_url": None,
            "synopsis": "Synopsis",
            "review": "",
            "rating": rating,
            "cover_url": None,
        },
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()


def test_stats_endpoint_with_books_and_quotes():
    headers = register_headers()
    dune = create_book(headers, "Dune", "Sci-Fi", "Goodreads", 5)
    create_book(headers, "1984", "Dystopian", "Open Library", 4)
    create_book(headers, "Foundation", "Sci-Fi", "Goodreads", 3)
    client.post(
        f"/books/{dune['id']}/quote-cards",
        json={"quote": "Fear is the mind-killer.", "relationship_label": "Resilience"},
        headers=headers,
    )

    response = client.get("/stats", headers=headers)

    assert response.status_code == 200
    data = response.json()
    assert data["total_books"] == 3
    assert data["average_rating"] == 4.0
    assert data["books_by_genre"] == {"Dystopian": 1, "Sci-Fi": 2}
    assert data["books_by_source"] == {"Goodreads": 2, "Open Library": 1}
    assert data["top_rated_sources"]["Goodreads"] == 4.0
    assert data["quotes_per_book"]["Dune"] == 1


def test_split_stats_endpoints_and_auth():
    headers = register_headers()
    create_book(headers, "Dune", "Sci-Fi", "Goodreads", 5)

    assert client.get("/stats/genres", headers=headers).json() == {"Sci-Fi": 1}
    assert client.get("/stats/sources", headers=headers).json() == {"Goodreads": 1}
    assert list(client.get("/stats/monthly", headers=headers).json().values()) == [1]
    assert client.get("/stats").status_code == 401
