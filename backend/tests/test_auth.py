import base64
from datetime import datetime, timedelta, timezone
import json

import pytest
from fastapi.testclient import TestClient

from app.dependencies import (
    book_repository,
    password_reset_repository,
    quote_card_repository,
    session_repository,
    user_repository,
)
from app.core.security import hash_token
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


def decode_jwt_payload(token: str) -> dict:
    payload = token.split(".")[1]
    payload += "=" * (-len(payload) % 4)
    return json.loads(base64.urlsafe_b64decode(payload).decode("utf-8"))


def register_user(
    email: str = "cristian@example.com",
    password: str = "secret123",
) -> dict:
    response = client.post(
        "/auth/register",
        json={
            "name": "Cristian",
            "email": email,
            "password": password,
        },
    )
    assert response.status_code == 201
    return response.json()


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
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["name"] == "Cristian"
    assert data["user"]["email"] == "cristian@example.com"
    assert data["user"]["role"] == "user"
    assert "books:read" in data["user"]["permissions"]


def test_register_rejects_invalid_data():
    response = client.post(
        "/auth/register",
        json={
            "name": "C",
            "email": "bad-email",
            "password": "short",
        },
    )

    assert response.status_code == 422


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
    register_user()

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
    assert "refresh_token" in data
    assert data["user"]["email"] == "cristian@example.com"


def test_login_invalid_password():
    register_user()

    response = client.post(
        "/auth/login",
        json={
            "email": "cristian@example.com",
            "password": "wrongpass",
        },
    )

    assert response.status_code == 401


def test_passwords_are_hashed():
    register_user()

    user = user_repository.get_by_email("cristian@example.com")

    assert user is not None
    assert user.password_hash != "secret123"
    assert user.password_hash.startswith("pbkdf2_sha256$")


def test_access_token_contains_role_permissions_and_expiry():
    data = register_user()

    payload = decode_jwt_payload(data["token"])

    assert payload["sub"] == data["user"]["id"]
    assert payload["role"] == "user"
    assert "user" in payload["roles"]
    assert "books:read" in payload["permissions"]
    assert isinstance(payload["exp"], int)
    assert isinstance(payload["sid"], str)


def test_get_current_user():
    token = register_user()["token"]

    response = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Cristian"
    assert data["email"] == "cristian@example.com"


def test_logout_success():
    token = register_user()["token"]

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


def test_normal_user_cannot_access_admin_endpoint():
    token = register_user()["token"]

    response = client.get(
        "/admin/logs",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 403


def test_admin_can_access_admin_endpoint():
    login_response = client.post(
        "/auth/login",
        json={"email": "admin@bookscape.test", "password": "admin123"},
    )
    assert login_response.status_code == 200

    response = client.get(
        "/admin/logs",
        headers={"Authorization": f"Bearer {login_response.json()['token']}"},
    )

    assert response.status_code == 200


def test_session_is_created_on_login_and_last_activity_updates():
    register_user()
    login_response = client.post(
        "/auth/login",
        json={
            "email": "cristian@example.com",
            "password": "secret123",
        },
    )
    token = login_response.json()["token"]
    session_id = decode_jwt_payload(token)["sid"]
    old_activity = datetime.now(timezone.utc) - timedelta(minutes=5)
    assert session_repository.force_inactive(session_id, last_activity_at=old_activity)

    response = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    session = session_repository.get(session_id)

    assert response.status_code == 200
    assert session is not None
    assert session.last_activity_at.replace(tzinfo=timezone.utc) > old_activity


def test_session_expires_after_inactivity():
    data = register_user()
    session_id = decode_jwt_payload(data["token"])["sid"]
    inactive_at = datetime.now(timezone.utc) - timedelta(minutes=31)
    assert session_repository.force_inactive(session_id, last_activity_at=inactive_at)

    response = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {data['token']}"},
    )

    assert response.status_code == 401


def test_refresh_flow_rotates_access_and_refresh_tokens():
    data = register_user()

    response = client.post(
        "/auth/refresh",
        json={"refresh_token": data["refresh_token"]},
    )

    assert response.status_code == 200
    refreshed = response.json()
    assert refreshed["token"] != data["token"]
    assert refreshed["refresh_token"] != data["refresh_token"]
    assert refreshed["user"]["email"] == "cristian@example.com"

    reused = client.post(
        "/auth/refresh",
        json={"refresh_token": data["refresh_token"]},
    )
    assert reused.status_code == 401


def test_protected_endpoint_rejects_invalid_token():
    response = client.get(
        "/books",
        headers={"Authorization": "Bearer invalid-token"},
    )

    assert response.status_code == 401


def test_password_reset_request_creates_demo_token():
    register_user()

    response = client.post(
        "/auth/password-reset/request",
        json={"email": "cristian@example.com"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["reset_token"]
    assert len(data["reset_token"]) >= 20


def test_password_reset_succeeds_with_valid_token():
    register_user()
    reset_response = client.post(
        "/auth/password-reset/request",
        json={"email": "cristian@example.com"},
    )
    token = reset_response.json()["reset_token"]

    response = client.post(
        "/auth/password-reset/confirm",
        json={"token": token, "new_password": "newsecret123"},
    )

    assert response.status_code == 200
    old_login = client.post(
        "/auth/login",
        json={"email": "cristian@example.com", "password": "secret123"},
    )
    new_login = client.post(
        "/auth/login",
        json={"email": "cristian@example.com", "password": "newsecret123"},
    )
    assert old_login.status_code == 401
    assert new_login.status_code == 200


def test_password_reset_fails_with_invalid_token():
    response = client.post(
        "/auth/password-reset/confirm",
        json={"token": "invalid-reset-token-value", "new_password": "newsecret123"},
    )

    assert response.status_code == 400


def test_password_reset_fails_with_expired_token():
    register_user()
    reset_response = client.post(
        "/auth/password-reset/request",
        json={"email": "cristian@example.com"},
    )
    token = reset_response.json()["reset_token"]
    auth_token_hash = hash_token(token)
    assert auth_token_hash

    password_reset_repository.force_expire(
        auth_token_hash,
        expires_at=datetime.now(timezone.utc) - timedelta(minutes=1),
    )

    response = client.post(
        "/auth/password-reset/confirm",
        json={"token": token, "new_password": "newsecret123"},
    )

    assert response.status_code == 400


def test_password_reset_fails_with_used_token():
    register_user()
    reset_response = client.post(
        "/auth/password-reset/request",
        json={"email": "cristian@example.com"},
    )
    token = reset_response.json()["reset_token"]

    first = client.post(
        "/auth/password-reset/confirm",
        json={"token": token, "new_password": "newsecret123"},
    )
    second = client.post(
        "/auth/password-reset/confirm",
        json={"token": token, "new_password": "anothersecret123"},
    )

    assert first.status_code == 200
    assert second.status_code == 400
