import os
import tempfile

_db = os.path.join(tempfile.mkdtemp(prefix="teamsync-test-"), "test.db")
os.environ.update(
    DATABASE_URL=f"sqlite+aiosqlite:///{_db}",
    REDIS_URL="",
    ENVIRONMENT="test",
    BCRYPT_ROUNDS="4",
)

import itertools  # noqa: E402

import pytest_asyncio  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402

import app.models  # noqa: E402,F401
from app.core.database import Base, engine  # noqa: E402
from app.main import app  # noqa: E402

_ids = itertools.count()


@pytest_asyncio.fixture(autouse=True)
async def fresh_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


@pytest_asyncio.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def signup(client, name: str | None = None) -> dict:
    """Register a user; returns {'headers', 'user', 'tokens'}."""
    name = name or f"user{next(_ids)}"
    r = await client.post(
        "/api/auth/register", json={"email": f"{name}@example.com", "username": name, "password": "password123"}
    )
    assert r.status_code == 201, r.text
    body = r.json()
    return {"headers": {"Authorization": f"Bearer {body['access_token']}"}, "user": body["user"], "tokens": body}


async def make_board(client, owner) -> dict:
    r = await client.post("/api/boards/", json={"title": "Sprint"}, headers=owner["headers"])
    assert r.status_code == 201, r.text
    board = (await client.get(f"/api/boards/{r.json()['id']}", headers=owner["headers"])).json()
    return board


async def make_task(client, who, column_id, title="Task", **extra) -> dict:
    r = await client.post("/api/tasks/", json={"title": title, "column_id": column_id, **extra}, headers=who["headers"])
    assert r.status_code == 201, r.text
    return r.json()


async def column_titles(client, who, board_id) -> dict[str, list[str]]:
    board = (await client.get(f"/api/boards/{board_id}", headers=who["headers"])).json()
    return {c["title"]: [t["title"] for t in c["tasks"]] for c in board["columns"]}
