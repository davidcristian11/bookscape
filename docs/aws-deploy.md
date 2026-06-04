# BookScape AWS University Demo Deployment

This guide prepares BookScape for a simple AWS demo deployment without changing local development. The target setup is:

- Frontend: AWS Amplify Hosting
- Backend: AWS Elastic Beanstalk Python
- PostgreSQL: Amazon RDS PostgreSQL
- MongoDB: MongoDB Atlas
- Realtime: WebSockets over `wss://`

Do not commit real secrets. Use AWS Elastic Beanstalk environment properties, AWS Secrets Manager, SSM Parameter Store, or MongoDB Atlas secret storage practices for production values.

## 1. Frontend Build

The frontend is a Vite single-page app and can be deployed as static files.

Local production build:

```powershell
cd frontend
npm ci
npm run build
```

The generated static files are written to:

```text
frontend/dist
```

Production frontend variables:

```text
VITE_API_BASE_URL=https://api.example.com
VITE_WS_URL=wss://api.example.com
VITE_INACTIVITY_TIMEOUT_MS=1800000
```

Replace `api.example.com` with the Elastic Beanstalk backend domain or a custom API domain.

## 2. Deploy Frontend To AWS Amplify

1. Open AWS Amplify Hosting.
2. Connect the BookScape repository.
3. Select the branch to deploy.
4. Set the app root to `frontend`.
5. Use `frontend/amplify.yml` as the build spec.
6. Add the frontend environment variables in Amplify:

```text
VITE_API_BASE_URL=https://api.example.com
VITE_WS_URL=wss://api.example.com
VITE_INACTIVITY_TIMEOUT_MS=1800000
```

7. Deploy the app.
8. Configure SPA rewrites so unknown routes serve `index.html`.

Amplify should build from the `frontend` app root and publish `dist`.

## 3. Configure RDS PostgreSQL

1. Create an Amazon RDS PostgreSQL database.
2. Use a small instance class for a university demo.
3. Create the database name, for example:

```text
bookscape_db
```

4. Keep RDS private in the same VPC as Elastic Beanstalk when possible.
5. Configure the RDS security group to allow port `5432` only from the Elastic Beanstalk backend security group.
6. Build the backend `DATABASE_URL`:

```text
DATABASE_URL=postgresql+psycopg://bookscape_user:REPLACE_WITH_PASSWORD@RDS-ENDPOINT:5432/bookscape_db
```

Do not use local Docker database credentials in AWS.

## 4. Configure MongoDB Atlas

1. Create a MongoDB Atlas project and cluster in an AWS region near the backend.
2. Create a database user for BookScape.
3. Allow network access from the backend. For a quick demo, use a temporary restricted rule if you know the outbound IP. Avoid broad access for long-lived deployments.
4. Copy the Atlas connection string.
5. Configure:

```text
MONGODB_URL=mongodb+srv://bookscape_user:REPLACE_WITH_PASSWORD@cluster0.example.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB=bookscape_chat
```

BookScape stores chat messages in MongoDB and creates an index on `created_at` at startup.

## 5. Deploy Backend To Elastic Beanstalk

Use the Elastic Beanstalk Python platform and deploy the contents of the `backend` directory as the application bundle. The backend includes:

```text
backend/Procfile
backend/requirements.txt
backend/alembic.ini
backend/app/
backend/alembic/
```

The Procfile starts FastAPI with:

```text
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Elastic Beanstalk should run one web process for the demo.

Backend environment variables:

```text
DATABASE_URL=postgresql+psycopg://bookscape_user:REPLACE_WITH_PASSWORD@RDS-ENDPOINT:5432/bookscape_db
MONGODB_URL=mongodb+srv://bookscape_user:REPLACE_WITH_PASSWORD@cluster0.example.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB=bookscape_chat
CORS_ORIGINS=https://main.exampleid.amplifyapp.com
CORS_ORIGIN_REGEX=^$
JWT_SECRET_KEY=REPLACE_WITH_LONG_RANDOM_SECRET
JWT_ACCESS_TOKEN_MINUTES=60
SESSION_LIFETIME_DAYS=7
SESSION_INACTIVITY_MINUTES=30
PASSWORD_RESET_MINUTES=30
AUTH_EXPOSE_RESET_TOKEN=false
```

Set these in Elastic Beanstalk configuration, not in a committed `.env` file.

## 6. Run Alembic Migrations Against RDS

Run migrations once before using the deployed backend.

From a machine or AWS environment that can reach RDS:

```powershell
cd backend
$env:DATABASE_URL="postgresql+psycopg://bookscape_user:REPLACE_WITH_PASSWORD@RDS-ENDPOINT:5432/bookscape_db"
python -m pip install -r requirements.txt
python -m alembic upgrade head
```

Alternative for CI/CD: run the same command as a one-off deployment step before switching traffic to the new backend.

Do not run migrations concurrently from multiple backend instances.

## 7. Configure CORS

For production, prefer exact frontend origins:

```text
CORS_ORIGINS=https://main.exampleid.amplifyapp.com
CORS_ORIGIN_REGEX=^$
```

If you use a custom frontend domain:

```text
CORS_ORIGINS=https://bookscape.example.com
CORS_ORIGIN_REGEX=^$
```

`CORS_ORIGIN_REGEX=^$` intentionally matches no normal browser origin, so only `CORS_ORIGINS` controls production access. Replace it only for a narrow and intentional pattern, such as controlled Amplify preview domains. Do not keep the broad local/LAN regex for production.

## 8. WebSockets Over WSS

The frontend must use:

```text
VITE_WS_URL=wss://api.example.com
```

The backend exposes:

```text
/ws/chat
/ws/books
/api/ws/chat
/api/ws/books
```

Use HTTPS on Elastic Beanstalk through its load balancer or a custom domain certificate. Browser WebSocket connections from an HTTPS frontend must use `wss://`, not `ws://`.

For this demo, run the backend as one instance. Chat and book realtime broadcasts are stored in process memory, so multiple backend instances would not share active WebSocket connection state. Scaling beyond one instance requires a shared broadcast layer such as Redis pub/sub.

## 9. Password Reset Token Safety

Production must set:

```text
AUTH_EXPOSE_RESET_TOKEN=false
```

When this is true, password reset request responses can include the one-time reset token for local lab demos. That is useful during development, but unsafe in production because it exposes account recovery tokens directly to clients.

## 10. Post-Deployment Test Checklist

After deployment, test:

- Frontend loads from Amplify over HTTPS.
- Login works with seeded demo credentials after migrations run.
- JWT access token and refresh flow work after page reload.
- Password reset request does not expose a reset token.
- REST book list, create, update, and delete work.
- GraphQL endpoint responds at `/graphql`.
- Chat history loads from MongoDB Atlas.
- Chat WebSocket connects through `wss://`.
- Book realtime WebSocket connects through `wss://`.
- CORS allows the Amplify frontend and rejects unrelated origins.
- Admin routes require admin permissions.
- Faker, scraper, sessions, auth, chat, and existing app features still work.

## 11. Local Development Stays The Same

Local development still uses:

```powershell
docker compose up -d postgres mongodb
cd backend
python -m alembic upgrade head
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

and:

```powershell
cd frontend
npm run dev -- --host 0.0.0.0
```

Keep using `backend/.env.example` and `frontend/.env.example` for local defaults. Use the production example files only as deployment templates.
