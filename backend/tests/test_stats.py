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


def build_book_payload(
    title: str,
    author: str,
    genre: str,
    year: int,
    status: str,
    rating: int,
) -> dict:
    return {
        "title": title,
        "author": author,
        "genre": genre,
        "year": year,
        "status": status,
        "rating": rating,
        "cover_url": None,
    }


def test_stats_endpoint_with_books():
    headers = register_and_get_headers()

    client.post(
        "/books",
        json=build_book_payload(
            title="Dune",
            author="Frank Herbert",
            genre="Sci-Fi",
            year=1965,
            status="to-read",
            rating=5,
        ),
        headers=headers,
    )
    client.post(
        "/books",
        json=build_book_payload(
            title="1984",
            author="George Orwell",
            genre="Dystopian",
            year=1949,
            status="reading",
            rating=4,
        ),
        headers=headers,
    )
    client.post(
        "/books",
        json=build_book_payload(
            title="Foundation",
            author="Isaac Asimov",
            genre="Sci-Fi",
            year=1951,
            status="finished",
            rating=3,
        ),
        headers=headers,
    )

    response = client.get("/stats", headers=headers)

    assert response.status_code == 200

    data = response.json()
    assert data["total_books"] == 3
    assert data["average_rating"] == 4.0
    assert data["books_by_status"] == {
        "to-read": 1,
        "reading": 1,
        "finished": 1,
    }
    assert data["books_by_genre"] == {
        "Dystopian": 1,
        "Sci-Fi": 2,
    }


def test_stats_endpoint_with_no_books():
    headers = register_and_get_headers()

    response = client.get("/stats", headers=headers)

    assert response.status_code == 200

    data = response.json()
    assert data["total_books"] == 0
    assert data["average_rating"] is None
    assert data["books_by_status"] == {
        "to-read": 0,
        "reading": 0,
        "finished": 0,
    }
    assert data["books_by_genre"] == {}


def test_stats_require_authentication():
    response = client.get("/stats")

    assert response.status_code == 401


def test_stats_are_user_specific():
    headers_user_1 = register_and_get_headers(
        name="Cristian",
        email="cristian1@example.com",
    )
    headers_user_2 = register_and_get_headers(
        name="Maria",
        email="maria@example.com",
    )

    client.post(
        "/books",
        json=build_book_payload(
            title="Dune",
            author="Frank Herbert",
            genre="Sci-Fi",
            year=1965,
            status="finished",
            rating=5,
        ),
        headers=headers_user_1,
    )

    response_user_1 = client.get("/stats", headers=headers_user_1)
    response_user_2 = client.get("/stats", headers=headers_user_2)

    assert response_user_1.status_code == 200
    assert response_user_2.status_code == 200

    data_user_1 = response_user_1.json()
    data_user_2 = response_user_2.json()

    assert data_user_1["total_books"] == 1
    assert data_user_2["total_books"] == 0