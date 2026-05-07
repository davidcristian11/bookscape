from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from strawberry.fastapi import GraphQLRouter

from app.graphql_schema import get_graphql_context, schema
from app.routes.auth import router as auth_router
from app.routes.automation import router as automation_router
from app.routes.books import router as books_router
from app.routes.nexus import router as nexus_router
from app.routes.quotes import router as quotes_router
from app.routes.stats import router as stats_router
from app.routes.ws import router as ws_router

app = FastAPI(
    title="BookScape API",
    version="1.0.0",
    description="In-memory REST API for managing books.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
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
app.include_router(books_router)
app.include_router(stats_router)
app.include_router(nexus_router)
app.include_router(quotes_router)
app.include_router(automation_router)
app.include_router(ws_router)
app.include_router(auth_router, prefix="/api")
app.include_router(books_router, prefix="/api")
app.include_router(stats_router, prefix="/api")
app.include_router(nexus_router, prefix="/api")
app.include_router(quotes_router, prefix="/api")
app.include_router(automation_router, prefix="/api")
app.include_router(ws_router, prefix="/api")
app.include_router(graphql_app, prefix="/graphql")


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "BookScape API is running"}
