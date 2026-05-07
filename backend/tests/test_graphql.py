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


def test_graphql_auth_mutations_and_me_query():
    register_response = client.post(
        "/graphql",
        json={
            "query": """
              mutation {
                register(name: "Graph Reader", email: "graph@example.com", password: "secret123") {
                  token
                  user { name email }
                }
              }
            """
        },
    )
    assert register_response.status_code == 200
    body = register_response.json()
    assert "errors" not in body
    assert body["data"]["register"]["user"]["email"] == "graph@example.com"

    token = body["data"]["register"]["token"]
    me_response = client.post(
        "/graphql",
        json={"query": "{ me { name email } }"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_response.json()["data"]["me"]["name"] == "Graph Reader"

    login_response = client.post(
        "/graphql",
        json={
            "query": """
              mutation {
                login(email: "graph@example.com", password: "secret123") {
                  user { email }
                }
              }
            """
        },
    )
    assert login_response.json()["data"]["login"]["user"]["email"] == "graph@example.com"


def test_graphql_requires_authentication_for_protected_fields():
    response = client.post(
        "/graphql",
        json={"query": "{ books { total } }"},
    )

    assert response.status_code == 200
    assert "Unauthorized" in response.json()["errors"][0]["message"]


def test_graphql_validation_and_not_found_errors():
    headers = register_headers()

    invalid_book = graphql(
        """
        mutation {
          createBook(input: {
            title: " ",
            author: "A",
            genre: "G",
            publicationYear: 2026,
            rating: 8
          }) { id }
        }
        """,
        headers,
    )
    assert "rating" in invalid_book.json()["errors"][0]["message"]

    missing_book = graphql(
        """
        mutation {
          updateBook(id: "missing", input: { title: "Still missing" }) { id }
        }
        """,
        headers,
    )
    assert "Book not found" in missing_book.json()["errors"][0]["message"]

    missing_quote = graphql(
        """
        mutation {
          updateQuoteCard(quoteId: "missing", input: { note: "Nope" }) { id }
        }
        """,
        headers,
    )
    assert "Quote not found" in missing_quote.json()["errors"][0]["message"]

    missing_quote_book = graphql(
        """
        query {
          quoteCardsByBook(bookId: "missing") { quote }
        }
        """,
        headers,
    )
    assert "Book not found" in missing_quote_book.json()["errors"][0]["message"]


def test_graphql_update_and_delete_book_flow():
    headers = register_headers()
    create_response = graphql(
        """
        mutation {
          createBook(input: {
            title: "Graph Book",
            author: "Ada",
            genre: "Testing",
            publicationYear: 2026,
            rating: 4
          }) { id title }
        }
        """,
        headers,
    )
    book_id = create_response.json()["data"]["createBook"]["id"]

    update_response = graphql(
        """
        mutation UpdateBook($id: String!) {
          updateBook(id: $id, input: { review: "Updated", rating: 5 }) {
            review
            rating
          }
        }
        """,
        headers,
        {"id": book_id},
    )
    assert update_response.json()["data"]["updateBook"]["review"] == "Updated"
    assert update_response.json()["data"]["updateBook"]["rating"] == 5

    query_response = graphql(
        "query Book($id: String!) { book(id: $id) { title rating } }",
        headers,
        {"id": book_id},
    )
    assert query_response.json()["data"]["book"]["title"] == "Graph Book"

    delete_response = graphql(
        "mutation DeleteBook($id: String!) { deleteBook(id: $id) }",
        headers,
        {"id": book_id},
    )
    assert delete_response.json()["data"]["deleteBook"] is True

    missing = graphql(
        "query Book($id: String!) { book(id: $id) { title } }",
        headers,
        {"id": book_id},
    )
    assert missing.json()["data"]["book"] is None
