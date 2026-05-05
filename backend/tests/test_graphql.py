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


def graphql(query: str, headers: dict[str, str], variables: dict | None = None):
    payload = {"query": query}
    if variables is not None:
        payload["variables"] = variables
    return client.post("/graphql", json=payload, headers=headers)


def test_graphql_book_and_quote_card_mutations():
    headers = register_headers()

    create_book = graphql(
        """
        mutation CreateBook($input: CreateBookInput!) {
          createBook(input: $input) {
            id
            title
            publicationYear
            source
          }
        }
        """,
        headers,
        {
            "input": {
                "title": "Dune",
                "author": "Frank Herbert",
                "genre": "Sci-Fi",
                "publicationYear": 1965,
                "source": "Manual",
                "synopsis": "Synopsis",
                "review": "",
                "rating": 5,
            }
        },
    )
    assert create_book.status_code == 200
    body = create_book.json()
    assert "errors" not in body
    book_id = body["data"]["createBook"]["id"]

    create_quote = graphql(
        """
        mutation CreateQuote($input: CreateQuoteInput!) {
          createQuoteCard(input: $input) {
            id
            bookId
            quote
            relationshipLabel
          }
        }
        """,
        headers,
        {
            "input": {
                "bookId": book_id,
                "quote": "Fear is the mind-killer.",
                "relationshipLabel": "Resilience",
            }
        },
    )
    assert create_quote.status_code == 200
    quote_body = create_quote.json()
    assert "errors" not in quote_body
    quote_id = quote_body["data"]["createQuoteCard"]["id"]

    query_response = graphql(
        """
        query Board($bookId: String!) {
          books(page: 1, pageSize: 10) { total items { title } }
          quoteCardsByBook(bookId: $bookId) { quote relationshipLabel }
        }
        """,
        headers,
        {"bookId": book_id},
    )
    assert query_response.status_code == 200
    query_body = query_response.json()
    assert query_body["data"]["books"]["total"] == 1
    assert query_body["data"]["quoteCardsByBook"][0]["relationshipLabel"] == "Resilience"

    delete_response = graphql(
        "mutation DeleteQuote($id: String!) { deleteQuoteCard(quoteId: $id) }",
        headers,
        {"id": quote_id},
    )
    assert delete_response.json()["data"]["deleteQuoteCard"] is True
