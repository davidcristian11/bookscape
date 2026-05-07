import time

import pytest
from fastapi.testclient import TestClient

from app.dependencies import (
    book_repository,
    faker_automation_service,
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
    faker_automation_service.force_reset()
    yield
    user_repository.clear()
    session_repository.clear()
    book_repository.clear()
    faker_automation_service.force_reset()


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
    book_repository.clear()
    token = response.json()["token"]
    return {"Authorization": f"Bearer {token}"}


def test_faker_loop_start_generates_books():
    headers = register_and_get_headers()

    start_response = client.post(
        "/automation/faker/start",
        json={"interval_seconds": 0.2},
        headers=headers,
    )

    assert start_response.status_code == 200
    assert start_response.json()["running"] is True

    time.sleep(0.55)

    books_response = client.get("/books?page=1&page_size=50", headers=headers)

    assert books_response.status_code == 200
    assert books_response.json()["total"] >= 2


def test_faker_loop_status_endpoint():
    headers = register_and_get_headers()

    stopped = client.get("/automation/faker/status", headers=headers)
    assert stopped.status_code == 200
    assert stopped.json()["running"] is False

    client.post(
        "/automation/faker/start",
        json={"interval_seconds": 0.2},
        headers=headers,
    )
    running = client.get("/automation/faker/status", headers=headers)
    assert running.status_code == 200
    assert running.json()["running"] is True


def test_faker_loop_cannot_start_twice_for_same_user():
    headers = register_and_get_headers()

    first = client.post(
        "/automation/faker/start",
        json={"interval_seconds": 0.2},
        headers=headers,
    )
    second = client.post(
        "/automation/faker/start",
        json={"interval_seconds": 0.2},
        headers=headers,
    )

    assert first.status_code == 200
    assert second.status_code == 409
    assert "already running" in second.json()["detail"]


def test_faker_loop_stop_is_idempotent_when_not_running():
    headers = register_and_get_headers()

    stop_response = client.post("/automation/faker/stop", headers=headers)

    assert stop_response.status_code == 200
    assert stop_response.json()["running"] is False
    assert stop_response.json()["interval_seconds"] is None


def test_faker_loop_stop_stops_generation():
    headers = register_and_get_headers()

    client.post(
        "/automation/faker/start",
        json={"interval_seconds": 0.15},
        headers=headers,
    )

    time.sleep(0.4)

    stop_response = client.post(
        "/automation/faker/stop",
        headers=headers,
    )

    assert stop_response.status_code == 200
    assert stop_response.json()["running"] is False

    first_count_response = client.get("/books?page=1&page_size=100", headers=headers)
    first_count = first_count_response.json()["total"]

    time.sleep(0.4)

    second_count_response = client.get("/books?page=1&page_size=100", headers=headers)
    second_count = second_count_response.json()["total"]

    assert second_count == first_count


def test_faker_loop_requires_authentication():
    start_response = client.post(
        "/automation/faker/start",
        json={"interval_seconds": 0.2},
    )
    stop_response = client.post("/automation/faker/stop")

    assert start_response.status_code == 401
    assert stop_response.status_code == 401


def test_faker_loop_is_user_specific():
    headers_user_1 = register_and_get_headers(
        name="Cristian",
        email="cristian1@example.com",
    )
    headers_user_2 = register_and_get_headers(
        name="Maria",
        email="maria@example.com",
    )

    start_response = client.post(
        "/automation/faker/start",
        json={"interval_seconds": 0.2},
        headers=headers_user_1,
    )
    assert start_response.status_code == 200

    time.sleep(0.45)

    books_user_1 = client.get("/books?page=1&page_size=100", headers=headers_user_1)
    books_user_2 = client.get("/books?page=1&page_size=100", headers=headers_user_2)

    assert books_user_1.status_code == 200
    assert books_user_2.status_code == 200

    assert books_user_1.json()["total"] >= 1
    assert books_user_2.json()["total"] == 0


def test_faker_loop_websocket_notification():
    headers = register_and_get_headers()
    token = headers["Authorization"].replace("Bearer ", "")

    with client.websocket_connect(f"/ws/books?token={token}") as websocket:
        connected = websocket.receive_json()
        assert connected["type"] == "ws_connected"

        start_response = client.post(
            "/automation/faker/start",
            json={"interval_seconds": 0.2},
            headers=headers,
        )
        assert start_response.status_code == 200

        started = websocket.receive_json()
        assert started["type"] == "faker_started"

        created = websocket.receive_json()
        assert created["type"] == "book_created"
        assert created["source"] == "faker_loop"
