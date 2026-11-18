# BookScape

A personal digital library: collect books, save quotes, connect ideas between books, see reading statistics and chat with other readers in real time.

Built with a React frontend and a FastAPI backend, using PostgreSQL for the main data and MongoDB for chat.

## Features

- **Library:** add, edit and delete books with pagination, filters and infinite scroll. Book details can be imported from Open Library.
- **Quote cards:** save quotes for each book.
- **Idea Nexus:** a canvas where quotes from different books become nodes you can arrange and connect.
- **Insights:** charts and statistics about your library.
- **Real-time chat** between logged-in users over WebSockets, stored in MongoDB.
- **Offline support:** changes made offline are queued and synced when the connection comes back.
- **Admin area:** activity logs and a watch list of suspicious behavior, such as repeated failed logins, access to restricted pages, bursts of deletes or chat spam.

## Security

- Passwords hashed with salted PBKDF2-HMAC-SHA256.
- Short-lived JWT access tokens with roles and permissions, plus refresh tokens.
- Sessions stored in PostgreSQL (only hashed refresh tokens), with expiry, revocation and logout after inactivity.
- Role-based access: admins and normal users see different parts of the app, enforced on both frontend and backend.
- Password recovery with one-time reset tokens.
- Optional HTTPS for testing on other devices in the local network.

## Tech stack

| Part | Technologies |
|---|---|
| Frontend | React, Vite, React Router, Recharts, React Flow, Framer Motion |
| Backend | FastAPI, Pydantic, REST + Strawberry GraphQL, WebSockets |
| Data | PostgreSQL, SQLAlchemy, Alembic migrations, MongoDB |
| Testing | pytest, Vitest, Playwright |
| Tooling | Docker Compose |

## Running locally

Requirements: Python, Node.js and Docker.

```bash
# databases
docker compose up -d postgres mongodb

# backend (http://127.0.0.1:8000)
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --reload

# frontend (http://localhost:5173)
cd frontend
npm install
cp .env.example .env
npm run dev
```

Local demo accounts, created automatically when the backend starts:

- Admin: `admin@bookscape.test` / `admin123`
- Reader: `reader@bookscape.test` / `reader123`

## Tests

```bash
cd backend && pytest            # backend
cd frontend && npm test         # frontend unit and component tests
cd frontend && npm run test:e2e # end-to-end, needs backend and databases running
```

## Project structure

```text
backend/    FastAPI app, SQLAlchemy models, Alembic migrations, pytest tests
frontend/   React app, Vitest and Playwright tests
docker-compose.yml
```
