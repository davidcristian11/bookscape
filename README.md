# BookScape

BookScape is a React/Vite + FastAPI personal digital library for collecting, scraping, reviewing, chatting about, and analyzing books. Assignment 4 Bronze/Silver hardens the Assignment 3 persistent app with secure auth, PostgreSQL sessions, JWT access tokens, role/permission authorization, password recovery, inactivity logout, and HTTPS/LAN demo support.

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

## Assignment 4 Bronze/Silver Checklist

- Bronze: secure login/register, hashed passwords, token-based user permissions, PostgreSQL sessions, inactivity logout, HTTPS/LAN documentation, and auth tests.
- Silver: role/permission authorization, permission-aware tokens, managed refresh/session flow, three auth flows, password recovery with one-time reset tokens, and admin/normal user restrictions.
- Not included in this pass: Gold/DDoS/JMeter/AI optimization work.

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
python -m pip install -r requirements.txt
Copy-Item .env.example .env
python -m alembic upgrade head
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Frontend

```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev -- --host 0.0.0.0
```

Frontend defaults to `http://localhost:5173` and backend defaults to `http://127.0.0.1:8000`.

## Demo Credentials

- Admin: `admin@bookscape.test` / `admin123`
- Normal user: `reader@bookscape.test` / `reader123`

Admin users see the Admin area with observation list and logs. Normal users can use library, insights, Idea Nexus, and chat, but cannot access admin data.

## Auth and Sessions

- Passwords are stored as salted PBKDF2-HMAC-SHA256 hashes. Legacy SHA-256 demo hashes are upgraded after a successful login.
- `/auth/login` and `/auth/register` return an expiring JWT access token in `token` plus a refresh token. The JWT includes user id, role, roles, permissions, expiry, and session id.
- Sessions live in PostgreSQL in `session_tokens`, store only the hashed refresh token, and track `created_at`, `last_activity_at`, `expires_at`, and `revoked_at`.
- Backend requests update `last_activity_at`; inactive or revoked sessions are rejected. Frontend inactivity logout defaults to 30 minutes via `VITE_INACTIVITY_TIMEOUT_MS`.
- Password recovery uses `/auth/password-reset/request` and `/auth/password-reset/confirm`. In dev/test, `AUTH_EXPOSE_RESET_TOKEN=true` returns the one-time reset token for demos. Set it to `false` for production-like runs.

## HTTPS / LAN Demo

The app still works on plain localhost HTTP. For a phone/LAN HTTPS demo, generate a trusted local certificate with `mkcert` if available:

```powershell
mkcert -install
mkdir certs
mkcert -key-file certs/bookscape-key.pem -cert-file certs/bookscape-cert.pem localhost 127.0.0.1 <LAPTOP_IP>
```

You can also use any self-signed certificate, but phones/browsers may show trust warnings unless the certificate authority is installed.

1. On the backend machine, run HTTPS on all interfaces:

```powershell
cd backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 --ssl-keyfile ..\certs\bookscape-key.pem --ssl-certfile ..\certs\bookscape-cert.pem
```

2. In `frontend/.env`, set either localhost or LAN URLs:

```text
VITE_API_BASE_URL=https://<LAPTOP_IP>:8000
VITE_WS_URL=wss://<LAPTOP_IP>:8000
VITE_INACTIVITY_TIMEOUT_MS=1800000
```

3. Run Vite on all interfaces. For the quick built-in self-signed mode:

```powershell
cd frontend
npm run dev -- --host 0.0.0.0 --https
```

Or, if you want Vite to use the mkcert files, set these in `frontend/.env`:

```text
VITE_HTTPS_KEY=../certs/bookscape-key.pem
VITE_HTTPS_CERT=../certs/bookscape-cert.pem
```

Then run:

```powershell
npm run dev -- --host 0.0.0.0
```

4. Open `https://<LAPTOP_IP>:5173` on the phone. The backend CORS regex in `backend/.env.example` allows localhost and IPv4 LAN HTTP/HTTPS origins by default.

## Tests

Backend:

```powershell
cd backend
python -m pytest
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
python -m alembic upgrade head
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Terminal 3
cd frontend
npm run dev

# Terminal 4
cd frontend
npm run test:e2e
```

## Implemented Features

- Persistent Book and QuoteCard CRUD with one-to-many `Book -> QuoteCards`.
- PostgreSQL-backed pagination, filters, statistics, auth sessions, password reset tokens, roles, permissions, logs, observation list, and Idea Nexus data.
- Admin and normal user demo roles with visible frontend restrictions.
- MongoDB-backed realtime chat over WebSockets for separate logged-in users.
- Suspicious behavior detection for repeated failed login, restricted access, delete bursts, and chat spam.
- Existing REST, GraphQL, offline queue/sync, WebSocket book updates, Faker loop, scraper, cookies, infinite scroll, and insights behavior are preserved.

## JetBrains PostgreSQL Inspection

Open the JetBrains Database tool window, add PostgreSQL, and use:

- URL: `jdbc:postgresql://localhost:5432/bookscape_db`
- User: `bookscape`
- Password: `bookscape_password`

Run `python -m alembic upgrade head` before inspecting tables.
