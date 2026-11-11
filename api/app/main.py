"""TeamSync API: FastAPI for REST, wrapped by Socket.IO for real-time board updates."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import app.models  # noqa: F401  (registers every table on Base.metadata)
from app.api import auth, boards, columns, comments, tasks
from app.core.config import settings
from app.core.database import Base, engine
from app.services.websocket import create_socketio_app

logging.basicConfig(level=logging.DEBUG if settings.DEBUG else logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Creates missing tables. Schema changes would need Alembic migrations.
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


fastapi_app = FastAPI(
    title="TeamSync API",
    description="Real-time collaborative Kanban boards",
    version="1.1.0",
    lifespan=lifespan,
)

fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

fastapi_app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
fastapi_app.include_router(boards.router, prefix="/api/boards", tags=["Boards"])
fastapi_app.include_router(columns.router, prefix="/api/columns", tags=["Columns"])
fastapi_app.include_router(tasks.router, prefix="/api/tasks", tags=["Tasks"])
fastapi_app.include_router(comments.router, prefix="/api/comments", tags=["Comments"])


@fastapi_app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "healthy", "service": "teamsync-api"}


# `uvicorn app.main:app` serves both: /socket.io/* → Socket.IO, everything else → FastAPI.
app = create_socketio_app(fastapi_app)
