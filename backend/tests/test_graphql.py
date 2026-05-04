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


def graphql_request(query: str, headers: dict[str, str], variables: dict | None = None):
    payload = {"query": query}
    if variables is not None:
        payload["variables"] = variables

    return client.post("/graphql", json=payload, headers=headers)


def test_graphql_books_query_and_book_query():
    headers = register_and_get_headers()

    create_response = client.post(
        "/books",
        json={
            "title": "Dune",
            "author": "Frank Herbert",
            "genre": "Sci-Fi",
            "year": 1965,
            "status": "to-read",
            "rating": 5,
            "cover_url": None,
        },
        headers=headers,
    )
    book_id = create_response.json()["id"]

    response = graphql_request(
        query="""
        query BooksAndBook($bookId: String!) {
          books(page: 1, pageSize: 10) {
            total
            page
            pageSize
            totalPages
            items {
              id
              title
              author
            }
          }
          book(id: $bookId) {
            id
            title
            genre
          }
        }
        """,
        headers=headers,
        variables={"bookId": book_id},
    )

    assert response.status_code == 200
    body = response.json()
    assert "errors" not in body

    assert body["data"]["books"]["total"] == 1
    assert body["data"]["books"]["items"][0]["title"] == "Dune"
    assert body["data"]["book"]["id"] == book_id
    assert body["data"]["book"]["genre"] == "Sci-Fi"


def test_graphql_create_update_delete_book():
    headers = register_and_get_headers()

    create_response = graphql_request(
        query="""
        mutation CreateBook($input: CreateBookInput!) {
          createBook(input: $input) {
            id
            title
            status
            rating
          }
        }
        """,
        headers=headers,
        variables={
            "input": {
                "title": "Dune",
                "author": "Frank Herbert",
                "genre": "Sci-Fi",
                "year": 1965,
                "status": "to-read",
                "rating": 5,
                "coverUrl": None,
            }
        },
    )

    assert create_response.status_code == 200
    create_body = create_response.json()
    assert "errors" not in create_body

    book_id = create_body["data"]["createBook"]["id"]
    assert create_body["data"]["createBook"]["title"] == "Dune"

    update_response = graphql_request(
        query="""
        mutation UpdateBook($id: String!, $input: UpdateBookInput!) {
          updateBook(id: $id, input: $input) {
            id
            title
            status
            rating
          }
        }
        """,
        headers=headers,
        variables={
            "id": book_id,
            "input": {
                "title": "Dune Updated",
                "status": "finished",
                "rating": 4,
            },
        },
    )

    assert update_response.status_code == 200
    update_body = update_response.json()
    assert "errors" not in update_body
    assert update_body["data"]["updateBook"]["title"] == "Dune Updated"
    assert update_body["data"]["updateBook"]["status"] == "finished"
    assert update_body["data"]["updateBook"]["rating"] == 4

    delete_response = graphql_request(
        query="""
        mutation DeleteBook($id: String!) {
          deleteBook(id: $id)
        }
        """,
        headers=headers,
        variables={"id": book_id},
    )

    assert delete_response.status_code == 200
    delete_body = delete_response.json()
    assert "errors" not in delete_body
    assert delete_body["data"]["deleteBook"] is True


def test_graphql_quote_queries_and_mutations():
    headers = register_and_get_headers()

    create_book_response = client.post(
        "/books",
        json={
            "title": "Dune",
            "author": "Frank Herbert",
            "genre": "Sci-Fi",
            "year": 1965,
            "status": "to-read",
            "rating": 5,
            "cover_url": None,
        },
        headers=headers,
    )
    book_id = create_book_response.json()["id"]

    create_quote_response = graphql_request(
        query="""
        mutation CreateQuote($input: CreateQuoteInput!) {
          createQuote(input: $input) {
            id
            bookId
            text
            note
            tag
          }
        }
        """,
        headers=headers,
        variables={
            "input": {
                "bookId": book_id,
                "text": "Fear is the mind-killer.",
                "note": "Important line",
                "tag": "theme",
            }
        },
    )

    assert create_quote_response.status_code == 200
    create_quote_body = create_quote_response.json()
    assert "errors" not in create_quote_body

    quote_id = create_quote_body["data"]["createQuote"]["id"]
    assert create_quote_body["data"]["createQuote"]["bookId"] == book_id

    quotes_query_response = graphql_request(
        query="""
        query QuotesByBook($bookId: String!) {
          quotesByBook(bookId: $bookId) {
            id
            text
            note
            tag
          }
        }
        """,
        headers=headers,
        variables={"bookId": book_id},
    )

    assert quotes_query_response.status_code == 200
    quotes_query_body = quotes_query_response.json()
    assert "errors" not in quotes_query_body
    assert len(quotes_query_body["data"]["quotesByBook"]) == 1
    assert quotes_query_body["data"]["quotesByBook"][0]["text"] == "Fear is the mind-killer."

    update_quote_response = graphql_request(
        query="""
        mutation UpdateQuote($quoteId: String!, $input: UpdateQuoteInput!) {
          updateQuote(quoteId: $quoteId, input: $input) {
            id
            text
            note
            tag
          }
        }
        """,
        headers=headers,
        variables={
            "quoteId": quote_id,
            "input": {
                "text": "Fear is the little-death.",
                "note": "Updated note",
                "tag": "theme",
            },
        },
    )

    assert update_quote_response.status_code == 200
    update_quote_body = update_quote_response.json()
    assert "errors" not in update_quote_body
    assert update_quote_body["data"]["updateQuote"]["text"] == "Fear is the little-death."

    delete_quote_response = graphql_request(
        query="""
        mutation DeleteQuote($quoteId: String!) {
          deleteQuote(quoteId: $quoteId)
        }
        """,
        headers=headers,
        variables={"quoteId": quote_id},
    )

    assert delete_quote_response.status_code == 200
    delete_quote_body = delete_quote_response.json()
    assert "errors" not in delete_quote_body
    assert delete_quote_body["data"]["deleteQuote"] is True