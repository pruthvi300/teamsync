"""Starts the real ASGI app (FastAPI + Socket.IO) under uvicorn and talks to it over the network."""

import asyncio
import socket
import threading
import time

import httpx
import pytest
import socketio
import uvicorn

from app.main import app


@pytest.fixture
def server_url():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
    server = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=port, log_level="warning", lifespan="off"))
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    deadline = time.time() + 10
    while not server.started and time.time() < deadline:
        time.sleep(0.05)
    yield f"http://127.0.0.1:{port}"
    server.should_exit = True
    thread.join(timeout=10)


async def _signup(http, name):
    r = await http.post(
        "/api/auth/register", json={"email": f"{name}@rt.io", "username": name, "password": "password123"}
    )
    body = r.json()
    return body["access_token"], {"Authorization": f"Bearer {body['access_token']}"}, body["user"]


async def test_members_receive_live_updates_and_outsiders_cannot_join(server_url):
    async with httpx.AsyncClient(base_url=server_url) as http:
        owner_token, owner_h, _ = await _signup(http, "owner")
        viewer_token, viewer_h, viewer = await _signup(http, "viewer")
        outsider_token, _, _ = await _signup(http, "outsider")

        board = (await http.post("/api/boards/", json={"title": "Live"}, headers=owner_h)).json()
        await http.post(f"/api/boards/{board['id']}/members", json={"email": viewer["email"]}, headers=owner_h)
        column_id = (await http.get(f"/api/boards/{board['id']}", headers=owner_h)).json()["columns"][0]["id"]

        # No token: refused.
        anonymous = socketio.AsyncClient()
        with pytest.raises(socketio.exceptions.ConnectionError):
            await anonymous.connect(server_url, transports=["websocket"])

        # Outsider: connects, but can't join the board's room.
        outsider = socketio.AsyncClient()
        await outsider.connect(server_url, auth={"token": outsider_token}, transports=["websocket"])
        assert (await outsider.call("join_board", {"board_id": board["id"]}))["ok"] is False
        await outsider.disconnect()

        # Member: joins and receives the task created by the owner.
        received = asyncio.get_running_loop().create_future()
        member = socketio.AsyncClient()
        member.on("task:created", lambda data: received.done() or received.set_result(data))
        await member.connect(server_url, auth={"token": viewer_token}, transports=["websocket"])
        assert (await member.call("join_board", {"board_id": board["id"]}))["ok"] is True

        await http.post("/api/tasks/", json={"title": "Ship it", "column_id": column_id}, headers=owner_h)
        event = await asyncio.wait_for(received, timeout=5)
        assert event["title"] == "Ship it"
        assert event["actor_id"] != viewer["id"]
        await member.disconnect()
        del owner_token
