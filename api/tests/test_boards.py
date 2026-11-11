from tests.conftest import make_board, make_task, signup


async def test_create_board_has_default_columns(client):
    owner = await signup(client)
    board = await make_board(client, owner)
    assert [c["title"] for c in board["columns"]] == ["To Do", "In Progress", "Done"]
    assert [m["id"] for m in board["members"]] == [owner["user"]["id"]]

    listing = (await client.get("/api/boards/", headers=owner["headers"])).json()
    assert listing[0]["member_count"] == 1


async def test_non_member_cannot_see_or_change_board(client):
    owner, outsider = await signup(client), await signup(client)
    board = await make_board(client, owner)
    task = await make_task(client, owner, board["columns"][0]["id"])

    h = outsider["headers"]
    assert (await client.get(f"/api/boards/{board['id']}", headers=h)).status_code == 403
    assert (await client.get(f"/api/tasks/{task['id']}", headers=h)).status_code == 403
    assert (await client.get(f"/api/comments/{task['id']}", headers=h)).status_code == 403
    assert (
        await client.post("/api/comments/", json={"content": "hi", "task_id": task["id"]}, headers=h)
    ).status_code == 403
    assert (
        await client.post("/api/columns/", json={"title": "X", "board_id": board["id"]}, headers=h)
    ).status_code == 403
    assert (await client.get("/api/boards/", headers=h)).json() == []


async def test_members_and_owner_permissions(client):
    owner, member = await signup(client), await signup(client)
    board = await make_board(client, owner)

    r = await client.post(
        f"/api/boards/{board['id']}/members", json={"email": member["user"]["email"]}, headers=owner["headers"]
    )
    assert r.status_code == 200
    assert len(r.json()["members"]) == 2
    again = await client.post(
        f"/api/boards/{board['id']}/members", json={"email": member["user"]["email"]}, headers=owner["headers"]
    )
    assert again.status_code == 409

    # Members can work on the board but not rename or delete it.
    assert (await client.get(f"/api/boards/{board['id']}", headers=member["headers"])).status_code == 200
    assert (
        await client.put(f"/api/boards/{board['id']}", json={"title": "Mine"}, headers=member["headers"])
    ).status_code == 403
    assert (await client.delete(f"/api/boards/{board['id']}", headers=member["headers"])).status_code == 403


async def test_delete_board_removes_everything(client):
    owner = await signup(client)
    board = await make_board(client, owner)
    task = await make_task(client, owner, board["columns"][0]["id"])
    await client.post("/api/comments/", json={"content": "note", "task_id": task["id"]}, headers=owner["headers"])

    assert (await client.delete(f"/api/boards/{board['id']}", headers=owner["headers"])).status_code == 204
    assert (await client.get(f"/api/boards/{board['id']}", headers=owner["headers"])).status_code == 404
    assert (await client.get(f"/api/tasks/{task['id']}", headers=owner["headers"])).status_code == 404


async def test_board_input_validation(client):
    owner = await signup(client)
    r = await client.post("/api/boards/", json={"title": "  ", "background_color": "red"}, headers=owner["headers"])
    assert r.status_code == 422


async def test_reorder_columns_requires_full_list(client):
    owner = await signup(client)
    board = await make_board(client, owner)
    ids = [c["id"] for c in board["columns"]]

    partial = await client.put(
        f"/api/columns/reorder/{board['id']}", json={"column_ids": ids[:2]}, headers=owner["headers"]
    )
    assert partial.status_code == 422
    ok = await client.put(
        f"/api/columns/reorder/{board['id']}", json={"column_ids": ids[::-1]}, headers=owner["headers"]
    )
    assert ok.status_code == 200
    board = (await client.get(f"/api/boards/{board['id']}", headers=owner["headers"])).json()
    assert [c["title"] for c in board["columns"]] == ["Done", "In Progress", "To Do"]


async def test_delete_column_cascades_and_compacts_positions(client):
    owner = await signup(client)
    board = await make_board(client, owner)
    todo = board["columns"][0]
    await make_task(client, owner, todo["id"])
    assert (await client.delete(f"/api/columns/{todo['id']}", headers=owner["headers"])).status_code == 204
    board = (await client.get(f"/api/boards/{board['id']}", headers=owner["headers"])).json()
    assert [(c["title"], c["position"]) for c in board["columns"]] == [("In Progress", 0), ("Done", 1)]
