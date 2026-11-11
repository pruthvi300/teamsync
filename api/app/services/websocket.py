"""
Real-time updates over Socket.IO.

- Clients connect with `auth: { token: <access token> }`; anonymous connections are refused.
- `join_board` only succeeds for members of that board.
- REST routes call `broadcast()` after committing, so every member viewing the
  board sees changes made by others. Events carry `actor_id`, letting clients
  skip echoes of their own actions.
- With REDIS_URL set, events fan out across all API instances.
"""

import inspect
import logging

import socketio

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.security import ACCESS, decode_token

log = logging.getLogger(__name__)

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=settings.cors_origins,
    client_manager=socketio.AsyncRedisManager(settings.REDIS_URL) if settings.REDIS_URL else None,
)


def room(board_id: str) -> str:
    return f"board_{board_id}"


async def _maybe_await(result) -> None:
    if inspect.isawaitable(result):
        await result


@sio.event
async def connect(sid, environ, auth):
    token = (auth or {}).get("token") if isinstance(auth, dict) else None
    user_id = decode_token(token, ACCESS) if token else None
    if user_id is None:
        raise socketio.exceptions.ConnectionRefusedError("authentication required")
    await sio.save_session(sid, {"user_id": user_id})


@sio.event
async def join_board(sid, data):
    from app.api.access import is_member  # local import avoids a cycle at startup

    board_id = (data or {}).get("board_id") if isinstance(data, dict) else None
    if not board_id:
        return {"ok": False, "error": "board_id required"}
    user_id = (await sio.get_session(sid))["user_id"]
    async with AsyncSessionLocal() as db:
        if not await is_member(db, board_id, user_id):
            return {"ok": False, "error": "not a member of this board"}
    await _maybe_await(sio.enter_room(sid, room(board_id)))
    return {"ok": True}


@sio.event
async def leave_board(sid, data):
    board_id = (data or {}).get("board_id") if isinstance(data, dict) else None
    if board_id:
        await _maybe_await(sio.leave_room(sid, room(board_id)))


async def broadcast(board_id: str, event: str, data: dict, actor_id: str) -> None:
    """Send an event to everyone viewing the board. Never fails the calling request."""
    try:
        await sio.emit(event, {**data, "actor_id": actor_id}, room=room(board_id))
    except Exception:
        log.exception("Broadcast of %s to board %s failed", event, board_id)


def create_socketio_app(app):
    """Wrap the FastAPI app: /socket.io/* goes to Socket.IO, everything else to FastAPI."""
    return socketio.ASGIApp(sio, other_asgi_app=app)
