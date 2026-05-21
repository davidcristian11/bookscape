# BookScape

BookScape is a React/Vite + FastAPI personal digital library for collecting, scraping, reviewing, chatting about, and analyzing books. Assignment 3 moves the app from RAM-only backend storage to PostgreSQL persistence, with MongoDB-backed realtime chat.

## Structure

```text
bookscape/
  frontend/        React/Vite app, Vitest tests, Playwright tests
  backend/         FastAPI app, SQLAlchemy models, Alembic migrations, pytest tests
  docker-compose.yml
  README.md
```

## Stack

- Frontend: React, Vite, React Router, Recharts, React Flow, Framer Motion
- Backend: FastAPI, Pydantic, Strawberry GraphQL, WebSockets, Faker
- Relational persistence: PostgreSQL, SQLAlchemy, Alembic
- Chat persistence: MongoDB

## Start Databases

```powershell
docker compose up -d postgres mongodb
```

PostgreSQL uses:

- Host: `localhost`
- Port: `5432`
- Database: `bookscape_db`
- User: `bookscape`
- Password: `bookscape_password`

MongoDB uses `mongodb://localhost:27017`, database `bookscape_chat`.

## Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Frontend

```powershell
cd frontend
npm install
copy .env.example .env
npm run dev
```

Frontend defaults to `http://localhost:5173` and backend defaults to `http://127.0.0.1:8000`.

## Demo Credentials

- Admin: `admin@bookscape.test` / `admin123`
- Normal user: `reader@bookscape.test` / `reader123`

Admin users see the Admin area with observation list and logs. Normal users can use library, insights, Idea Nexus, and chat, but cannot access admin data.

## LAN / VM Demo

1. On the backend machine, run:

```powershell
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

2. On the frontend machine, set `frontend/.env`:

```text
VITE_API_BASE_URL=http://<backend-lan-ip>:8000
```

3. Run:

```powershell
cd frontend
npm run dev -- --host 0.0.0.0
```

The backend CORS regex in `backend/.env.example` allows localhost and IPv4 LAN origins by default.

## Tests

Backend:

```powershell
cd backend
pytest
```

Frontend unit/component tests:

```powershell
cd frontend
npm test
npm run coverage
```

Playwright:

```powershell
# Terminal 1
docker compose up -d postgres mongodb

# Terminal 2
cd backend
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Terminal 3
cd frontend
npm run dev

# Terminal 4
cd frontend
npm run test:e2e
```

## Implemented Features

- Persistent Book and QuoteCard CRUD with one-to-many `Book -> QuoteCards`.
- PostgreSQL-backed pagination, filters, statistics, auth sessions, roles, permissions, logs, observation list, and Idea Nexus data.
- Admin and normal user demo roles with visible frontend restrictions.
- MongoDB-backed realtime chat over WebSockets for separate logged-in users.
- Suspicious behavior detection for repeated failed login, restricted access, delete bursts, and chat spam.
- Existing REST, GraphQL, offline queue/sync, WebSocket book updates, Faker loop, scraper, cookies, infinite scroll, and insights behavior are preserved.

## JetBrains PostgreSQL Inspection

Open the JetBrains Database tool window, add PostgreSQL, and use:

- URL: `jdbc:postgresql://localhost:5432/bookscape_db`
- User: `bookscape`
- Password: `bookscape_password`

Run `alembic upgrade head` before inspecting tables.
