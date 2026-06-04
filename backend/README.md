# BookScape Backend

FastAPI backend for BookScape. PostgreSQL is the source of truth for books, quote cards, users, roles, permissions, sessions, password reset tokens, logs, observations, and Idea Nexus data. MongoDB stores chat messages.

## Setup

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Start PostgreSQL and MongoDB from the project root:

```powershell
docker compose up -d postgres mongodb
```

Run migrations:

```powershell
cd backend
python -m alembic upgrade head
```

Run the API:

```powershell
cd backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

For HTTPS/LAN:

```powershell
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 --ssl-keyfile <path-to-key> --ssl-certfile <path-to-cert>
```

## Demo Credentials

- Admin: `admin@bookscape.test` / `admin123`
- Normal user: `reader@bookscape.test` / `reader123`

These are seeded at startup after the database schema exists.

## Assignment 4 Auth Notes

- Passwords are salted PBKDF2-HMAC-SHA256 hashes. Existing legacy SHA-256 hashes are upgraded after successful login.
- JWT access tokens include user id, session id, role, roles, permissions, issued-at, and expiry.
- PostgreSQL sessions store hashed refresh tokens and track creation, last activity, expiry, and revocation.
- `/auth/refresh` rotates refresh tokens and returns a new access token.
- `/auth/password-reset/request` creates one-time reset tokens. With `AUTH_EXPOSE_RESET_TOKEN=true`, the response includes the token for lab demos.
- `/auth/password-reset/confirm` consumes the token, updates the password, marks the token used, and revokes active sessions for that user.
- Admin routes require both the admin role and `logs:read`; normal users keep access to their own library, quote cards, chat, insights, offline sync, scraper, and Faker loop.

## Tests

```powershell
cd backend
python -m pytest
```

Tests use a SQLite database file under `backend/.tmp/` and `memory://` chat storage so they do not require Docker.

## Main Modules

- `database.py`: SQLAlchemy engine/session/Base
- `alembic/`: relational schema migrations
- `models/`: SQLAlchemy ORM models
- `repositories/`: database-backed data access
- `services/`: business logic, logging, suspicious behavior rules, chat storage
- `routes/`: REST and WebSocket entry points
- `schemas/`: Pydantic request/response models

## Main Endpoints

- `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `POST /auth/logout`
- `POST /auth/refresh`, `POST /auth/password-reset/request`, `POST /auth/password-reset/confirm`
- `GET /books?page=1&page_size=10`, with optional `genre`, `source`, `rating_min`, `rating_max`, `search`
- `POST /books`, `GET /books/{id}`, `PUT /books/{id}`, `DELETE /books/{id}`
- `POST /books/scrape`
- `GET/POST /books/{book_id}/quote-cards`
- `PUT/DELETE /quote-cards/{quote_card_id}`
- `GET /stats`, `/stats/genres`, `/stats/sources`, `/stats/monthly`, `/stats/quotes`
- `GET /admin/observation-list`, `GET /admin/logs`
- `GET /chat/messages`, `POST /chat/messages`, `WS /ws/chat`
- `POST /automation/faker/start`, `POST /automation/faker/stop`, `GET /automation/faker/status`
- `WS /ws/books`
- `POST /graphql`

The same routes are also exposed under `/api/...` for compatibility.

## JetBrains Database Inspection

In JetBrains Database tool window, add a PostgreSQL data source:

- Host: `localhost`
- Port: `5432`
- Database: `bookscape_db`
- User: `bookscape`
- Password: `bookscape_password`

Then inspect tables such as `books`, `quote_cards`, `users`, `roles`, `permissions`, `log_entries`, and `observation_list_entries`.
