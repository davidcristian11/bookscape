# BookScape Backend

FastAPI backend for BookScape. Data is stored only in process memory through repository classes.

Run:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Run tests:

```powershell
pytest
```

Main modules:

- `routes/`: HTTP and WebSocket entry points
- `schemas/`: Pydantic request/response validation
- `services/`: business logic
- `repositories/`: RAM-only collections
- `models/`: internal dataclass domain models

Important behavior:

- `POST /books/scrape` fetches the submitted page with `httpx`, a safe timeout, and a project User-Agent.
- The scraper parses JSON-LD schema.org Book data, OpenGraph tags, meta descriptions, page title, author/image/rating/year fields, and source names for Goodreads, Amazon, Barnes & Noble, Open Library, or generic pages.
- `POST /automation/faker/start`, `POST /automation/faker/stop`, and `GET /automation/faker/status` control the required async Faker loop. Generated books are broadcast through `/ws/books`.
- On registration, `SeedService` creates RAM-only demo Books and QuoteCards so Idea Nexus has meaningful first-run data.
- Tests mock scraper network behavior; they do not depend on live external websites.
- GraphQL uses the same auth/session mechanism as REST. In GraphiQL, add `{"Authorization": "Bearer <token>"}` to HTTP headers, or run the `login` GraphQL mutation first and copy the returned token.
- Backend restarts clear sessions and data because all assignment storage is RAM-only.
- The frontend may keep a client-side offline Book CRUD queue and minimal last-known profile data while the backend is unreachable. After a backend restart, users must log in/register again before that client-side queue can sync with the new in-memory session.

No database or persistence layer is used.
