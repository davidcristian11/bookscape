# BookScape

BookScape is a personal digital library app for collecting, scraping, reviewing, and analyzing books. The main domain entity is `Book`, with a Gold-level one-to-many relationship from `Book` to `QuoteCard` for connected quotes and ideas.

## Stack

- Frontend: React, Vite, React Router, Recharts, React Flow, Framer Motion
- Backend: FastAPI, Pydantic, Strawberry GraphQL, WebSockets, Faker
- Storage: RAM only on the server. There is no database, ORM, file persistence, SQLite, Postgres, MongoDB, or external storage.

## Run Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Backend defaults to `http://127.0.0.1:8000`.

## Run Frontend

```powershell
npm install
npm run dev
```

Frontend defaults to `http://localhost:5173`. Set `VITE_API_BASE_URL=http://127.0.0.1:8000` if needed.

## Implemented Features

- Landing page with BookScape identity, tagline, description, and CTA.
- Mock in-memory authentication with register, login, logout, and protected routes.
- My Library master view with table/grid modes, server pagination, and infinite scroll.
- Book CRUD with title, author, genre, publication year, source, source URL, synopsis, review, rating, and optional cover URL.
- Scrape Book Data flow that fetches real book pages with a safe timeout/User-Agent and parses OpenGraph, JSON-LD schema.org Book data, meta descriptions, page titles, and source fallbacks.
- Reading Insights charts for genres, sources, monthly additions, ratings, and quote relationships.
- Idea Nexus board backed by the real `Book -> QuoteCards` relationship.
- Offline detection and queued create/update/delete operations for books, synchronized when the backend is reachable again. If the backend restarts, the queue is preserved client-side until the user logs in/registers again.
- WebSocket updates for book creation/update/deletion and Faker-generated books.
- Async Faker loop start/stop/status endpoints. The frontend exposes loop controls only, not one-shot fake generation.
- New accounts are seeded in RAM with demo books and connected QuoteCards so Idea Nexus is meaningful on first launch.
- REST plus additional GraphQL queries/mutations for books and quote cards.
- Cookie-based monitoring for visits, last section, last active timestamp, `bookscape_view_mode`, and `bookscape_page_size`.

## Assignment 1 Checklist

- Bronze: presentation view, master/detail Book views, paginated table, CRUD, client-side validation, separated API/service files and components.
- Silver: cookie-based user activity/preference monitoring is implemented, with practical frontend tests.
- Gold: concept pages are connected, responsive layout is preserved, animations/transitions are tasteful, charts update from shared data, and Playwright scenarios cover three main flows.

## Assignment 2 Checklist

- Bronze: FastAPI REST API, server-side validation, separated routes/services/repositories/schemas/models, RAM-only repositories, server-side pagination, statistics endpoints.
- Silver: offline detection/sync on the frontend, async Faker generation loop on the backend, WebSocket notifications, status endpoint, and UI connection/sync states.
- Gold: GraphQL interface is available at `/graphql`, frontend infinite scroll uses backend pagination, and fullstack `Book -> QuoteCards` CRUD/statistics are implemented and tested.

## Run Tests

Backend:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
pytest
```

Frontend unit/component tests:

```powershell
npm test
```

Frontend coverage:

```powershell
npm run coverage
```

Playwright E2E:

```powershell
# Terminal 1
cd backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload

# Terminal 2
npm run dev

# Terminal 3
npm run test:e2e
```

## Main Endpoints

- `GET /books?page=1&page_size=10` and `GET /api/books?page=1&page_size=10`
- `POST /books`, `GET /books/{book_id}`, `PUT /books/{book_id}`, `DELETE /books/{book_id}`
- `POST /books/scrape`
- `GET /books/{book_id}/quote-cards`, `POST /books/{book_id}/quote-cards`
- `PUT /quote-cards/{quote_card_id}`, `DELETE /quote-cards/{quote_card_id}`
- `GET /stats`, `GET /stats/genres`, `GET /stats/sources`, `GET /stats/monthly`, `GET /stats/quotes`
- `POST /automation/faker/start`, `POST /automation/faker/stop`, `GET /automation/faker/status`
- `WS /ws/books`
- `POST /graphql`

## GraphQL Demo

GraphQL uses the same RAM-only users, sessions, services, and repositories as REST. A book created through REST appears in GraphQL, and GraphQL mutations write to the same in-memory repositories.

1. Open `http://127.0.0.1:8000/graphql`.
2. Run a register or login mutation:

```graphql
mutation {
  register(name: "reader", email: "reader@example.com", password: "secret123") {
    token
    user {
      id
      name
      email
    }
  }
}
```

3. Copy the returned token.
4. In GraphiQL HTTP headers, add:

```json
{
  "Authorization": "Bearer <token>"
}
```

5. Run the paginated books query:

```graphql
query {
  books(page: 1, pageSize: 10) {
    items {
      id
      title
      author
    }
    total
  }
}
```

## Offline Demo

Use browser DevTools Network Offline to demonstrate offline mode. Add/update/delete books while offline, then switch back online to see queued operations sync. This is the recommended demo path because it keeps the in-memory backend session alive.

If the backend is stopped or restarted, server data and sessions are cleared by design because the assignment requires RAM-only storage. BookScape keeps safe client-side offline state, including the last known user id/name/email, cached books, and queued Book CRUD operations. It does not store plaintext passwords and does not pretend the server session survived.

After a backend restart, the app keeps queued offline changes and shows that the in-memory server session expired. Log in or register again, then BookScape reuses the new token/session and retries syncing the existing offline queue.

## Known Limitations

- User accounts and sessions are mock/in-memory and reset when the backend restarts. After a restart, log in/register again before queued offline changes can sync.
- Real sites can block scraping or omit metadata. The backend returns a clear error when fetching is blocked and uses small defaults only for missing fields such as unknown author, genre, or rating.
- Offline queueing is implemented for Book CRUD; QuoteCard CRUD is online-first.
- Server data is intentionally lost on restart because Assignment 2 forbids persistence.
