# BookScape Frontend

React/Vite frontend for BookScape. The frontend now lives in `frontend/` and talks to a configurable backend URL.

## Setup

```powershell
cd frontend
npm install
copy .env.example .env
npm run dev
```

Default API URL:

```text
VITE_API_BASE_URL=http://127.0.0.1:8000
```

For LAN or VM demos, set this to the backend machine address, for example:

```text
VITE_API_BASE_URL=http://192.168.1.25:8000
```

Then run Vite on all interfaces:

```powershell
npm run dev -- --host 0.0.0.0
```

## Tests

```powershell
cd frontend
npm test
npm run coverage
npm run test:e2e
```

Playwright expects the backend and frontend dev server to be running unless you set your own `PLAYWRIGHT_BASE_URL`.
