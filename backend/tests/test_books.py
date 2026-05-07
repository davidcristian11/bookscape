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


def register_headers(clear_seed: bool = True) -> dict[str, str]:
    response = client.post(
        "/auth/register",
        json={"name": "Reader", "email": "reader@example.com", "password": "secret123"},
    )
    assert response.status_code == 201
    if clear_seed:
        book_repository.clear()
        quote_card_repository.clear()
    return {"Authorization": f"Bearer {response.json()['token']}"}


def book_payload(title: str = "Dune", rating: int = 5) -> dict:
    return {
        "title": title,
        "author": "Frank Herbert",
        "genre": "Sci-Fi",
        "publication_year": 1965,
        "source": "Goodreads",
        "source_url": "https://www.goodreads.com/book/show/44767458-dune",
        "synopsis": "A desert planet and a political inheritance.",
        "review": "Excellent.",
        "rating": rating,
        "cover_url": None,
    }


def test_book_create_read_update_delete():
    headers = register_headers()

    create_response = client.post("/books", json=book_payload(), headers=headers)
    assert create_response.status_code == 201
    created = create_response.json()
    assert created["title"] == "Dune"
    assert created["publication_year"] == 1965
    assert created["source"] == "Goodreads"

    read_response = client.get(f"/books/{created['id']}", headers=headers)
    assert read_response.status_code == 200
    assert read_response.json()["id"] == created["id"]

    update_response = client.put(
        f"/books/{created['id']}",
        json={"rating": 4, "review": "Still excellent, but dense."},
        headers=headers,
    )
    assert update_response.status_code == 200
    assert update_response.json()["rating"] == 4
    assert update_response.json()["review"] == "Still excellent, but dense."

    delete_response = client.delete(f"/books/{created['id']}", headers=headers)
    assert delete_response.status_code == 204
    assert client.get(f"/books/{created['id']}", headers=headers).status_code == 404


def test_book_validation_errors_are_returned():
    headers = register_headers()

    response = client.post(
        "/books",
        json={**book_payload(), "title": "   ", "rating": 9},
        headers=headers,
    )

    assert response.status_code == 422
    details = str(response.json()["detail"])
    assert "title" in details
    assert "rating" in details


def test_server_side_pagination():
    headers = register_headers()
    for index in range(7):
        response = client.post(
            "/books",
            json=book_payload(title=f"Book {index + 1}", rating=(index % 5) + 1),
            headers=headers,
        )
        assert response.status_code == 201

    page_one = client.get("/books?page=1&page_size=3", headers=headers).json()
    page_three = client.get("/books?page=3&page_size=3", headers=headers).json()

    assert page_one["total"] == 7
    assert page_one["total_pages"] == 3
    assert len(page_one["items"]) == 3
    assert len(page_three["items"]) == 1


def test_register_seeds_demo_books_and_quote_cards():
    headers = register_headers(clear_seed=False)

    books = client.get("/books?page=1&page_size=20", headers=headers).json()
    assert books["total"] == 3

    quote_counts = [
        len(client.get(f"/books/{book['id']}/quote-cards", headers=headers).json())
        for book in books["items"]
    ]
    assert sum(quote_counts) == 5


def test_scrape_endpoint_parses_json_ld_and_meta(monkeypatch):
    headers = register_headers()
    html = """
    <html>
      <head>
        <title>Ignored site title</title>
        <meta property="og:image" content="https://example.com/cover.jpg" />
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Book",
            "name": "The Metadata Book",
            "author": {"@type": "Person", "name": "Ada Parser"},
            "genre": "Nonfiction",
            "datePublished": "2020-04-10",
            "description": "A book described through structured data.",
            "aggregateRating": {"ratingValue": "4.6"}
          }
        </script>
      </head>
    </html>
    """

    from app.dependencies import scraper_service

    monkeypatch.setattr(scraper_service, "_fetch", lambda url: html)

    response = client.post(
        "/books/scrape",
        json={"url": "https://example.com/books/metadata"},
        headers=headers,
    )

    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "The Metadata Book"
    assert data["author"] == "Ada Parser"
    assert data["publication_year"] == 2020
    assert data["rating"] == 5
    assert data["source"] == "Generic Book Page"


def test_scrape_endpoint_returns_clear_error(monkeypatch):
    headers = register_headers()

    from app.dependencies import scraper_service
    from app.services.scraper_service import ScraperError

    monkeypatch.setattr(
        scraper_service,
        "_fetch",
        lambda url: (_ for _ in ()).throw(ScraperError("The source blocked scraping.")),
    )

    response = client.post(
        "/books/scrape",
        json={"url": "https://www.goodreads.com/book/show/1"},
        headers=headers,
    )

    assert response.status_code == 422
    assert "blocked" in response.json()["detail"]
