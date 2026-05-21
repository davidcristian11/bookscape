from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from strawberry.fastapi import GraphQLRouter

from app.core.config import get_settings
from app.dependencies import chat_service, seed_service
from app.graphql_schema import get_graphql_context, schema
from app.routes.admin import router as admin_router
from app.routes.auth import router as auth_router
from app.routes.automation import router as automation_router
from app.routes.books import router as books_router
from app.routes.chat import router as chat_router
from app.routes.nexus import router as nexus_router
from app.routes.quotes import router as quotes_router
from app.routes.stats import router as stats_router
from app.routes.ws import router as ws_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    seed_service.seed_auth_defaults()
    await chat_service.connect_storage()
    yield
    await chat_service.close_storage()


app = FastAPI(
    title="BookScape API",
    version="3.0.0",
    description="Persistent REST, GraphQL, WebSocket, and chat API for BookScape.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=settings.cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

graphql_app = GraphQLRouter(
    schema,
    context_getter=get_graphql_context,
    graphql_ide="graphiql",
)

app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(books_router)
app.include_router(chat_router)
app.include_router(stats_router)
app.include_router(nexus_router)
app.include_router(quotes_router)
app.include_router(automation_router)
app.include_router(ws_router)
app.include_router(auth_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(books_router, prefix="/api")
app.include_router(chat_router, prefix="/api")
app.include_router(stats_router, prefix="/api")
app.include_router(nexus_router, prefix="/api")
app.include_router(quotes_router, prefix="/api")
app.include_router(automation_router, prefix="/api")
app.include_router(ws_router, prefix="/api")
app.include_router(graphql_app, prefix="/graphql")


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "BookScape API is running"}
