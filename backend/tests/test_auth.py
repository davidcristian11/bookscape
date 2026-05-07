import pytest
from fastapi.testclient import TestClient

from app.dependencies import book_repository, quote_card_repository, session_repository, user_repository
from app.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def clear_auth_repositories():
    user_repository.clear()
    session_repository.clear()
    book_repository.clear()
    quote_card_repository.clear()
    yield
    user_repository.clear()
    session_repository.clear()
    book_repository.clear()
    quote_card_repository.clear()


def test_register_success():
    response = client.post(
        "/auth/register",
        json={
            "name": "Cristian",
            "email": "cristian@example.com",
            "password": "secret123",
        },
    )

    assert response.status_code == 201
    data = response.json()

    assert "token" in data
    assert data["user"]["name"] == "Cristian"
    assert data["user"]["email"] == "cristian@example.com"


def test_register_duplicate_email():
    client.post(
        "/auth/register",
        json={
            "name": "Cristian",
            "email": "cristian@example.com",
            "password": "secret123",
        },
    )

    response = client.post(
        "/auth/register",
        json={
            "name": "Other User",
            "email": "cristian@example.com",
            "password": "anotherpass",
        },
    )

    assert response.status_code == 409


def test_login_success():
    client.post(
        "/auth/register",
        json={
            "name": "Cristian",
            "email": "cristian@example.com",
            "password": "secret123",
        },
    )

    response = client.post(
        "/auth/login",
        json={
            "email": "cristian@example.com",
            "password": "secret123",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert "token" in data
    assert data["user"]["email"] == "cristian@example.com"


def test_login_invalid_password():
    client.post(
        "/auth/register",
        json={
            "name": "Cristian",
            "email": "cristian@example.com",
            "password": "secret123",
        },
    )

    response = client.post(
        "/auth/login",
        json={
            "email": "cristian@example.com",
            "password": "wrongpass",
        },
    )

    assert response.status_code == 401


def test_get_current_user():
    register_response = client.post(
        "/auth/register",
        json={
            "name": "Cristian",
            "email": "cristian@example.com",
            "password": "secret123",
        },
    )

    token = register_response.json()["token"]

    response = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Cristian"
    assert data["email"] == "cristian@example.com"


def test_logout_success():
    register_response = client.post(
        "/auth/register",
        json={
            "name": "Cristian",
            "email": "cristian@example.com",
            "password": "secret123",
        },
    )

    token = register_response.json()["token"]

    logout_response = client.post(
        "/auth/logout",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert logout_response.status_code == 200

    me_response = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert me_response.status_code == 401


def test_auth_requires_valid_bearer_header():
    assert client.get("/auth/me").status_code == 401
    assert client.get("/auth/me", headers={"Authorization": "Token abc"}).status_code == 401
    assert client.get("/auth/me", headers={"Authorization": "Bearer "}).status_code == 401


def test_logout_rejects_expired_session_token():
    response = client.post(
        "/auth/logout",
        headers={"Authorization": "Bearer missing-token"},
    )

    assert response.status_code == 401
