# BookScape Backend

FastAPI backend for BookScape Assignment 3. PostgreSQL is the source of truth for books, quote cards, users, roles, permissions, sessions, logs, observations, and Idea Nexus data. MongoDB stores chat messages.

## Setup

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
```

Start PostgreSQL and MongoDB from the project root:

```powershell
docker compose up -d postgres mongodb
```

Run migrations:

```powershell
cd backend
alembic upgrade head
```

Run the API:

```powershell
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Demo Credentials

- Admin: `admin@bookscape.test` / `admin123`
- Normal user: `reader@bookscape.test` / `reader123`

These are seeded at startup after the database schema exists.

## Tests

```powershell
cd backend
pytest
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
