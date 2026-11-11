from tests.conftest import column_titles, make_board, make_task, signup


async def setup_board(client):
    owner = await signup(client)
    board = await make_board(client, owner)
    todo, doing, done = (c["id"] for c in board["columns"])
    for title in ["A", "B", "C"]:
        await make_task(client, owner, todo, title)
    return owner, board, todo, doing, done


async def task_id(client, owner, board, title):
    board = (await client.get(f"/api/boards/{board['id']}", headers=owner["headers"])).json()
    return next(t["id"] for c in board["columns"] for t in c["tasks"] if t["title"] == title)


async def move(client, owner, tid, column_id, position):
    return await client.put(
        f"/api/tasks/{tid}/move", json={"column_id": column_id, "position": position}, headers=owner["headers"]
    )


async def test_move_within_column_down_and_up(client):
    owner, board, todo, *_ = await setup_board(client)
    await move(client, owner, await task_id(client, owner, board, "A"), todo, 2)
    assert (await column_titles(client, owner, board["id"]))["To Do"] == ["B", "C", "A"]
    await move(client, owner, await task_id(client, owner, board, "A"), todo, 0)
    assert (await column_titles(client, owner, board["id"]))["To Do"] == ["A", "B", "C"]


async def test_move_across_columns_including_empty_and_past_end(client):
    owner, board, todo, doing, _ = await setup_board(client)
    r = await move(client, owner, await task_id(client, owner, board, "B"), doing, 0)
    assert r.status_code == 200
    r = await move(client, owner, await task_id(client, owner, board, "A"), doing, 99)  # clamped to the end
    assert r.json()["position"] == 1
    titles = await column_titles(client, owner, board["id"])
    assert titles["To Do"] == ["C"] and titles["In Progress"] == ["B", "A"]

    board_data = (await client.get(f"/api/boards/{board['id']}", headers=owner["headers"])).json()
    for column in board_data["columns"]:
        assert [t["position"] for t in column["tasks"]] == list(range(len(column["tasks"])))


async def test_cannot_move_task_into_another_board(client):
    owner, board, *_ = await setup_board(client)
    other = await make_board(client, owner)
    r = await move(client, owner, await task_id(client, owner, board, "A"), other["columns"][0]["id"], 0)
    assert r.status_code == 422


async def test_cannot_move_into_board_you_are_not_in(client):
    owner, board, *_ = await setup_board(client)
    stranger = await signup(client)
    foreign = await make_board(client, stranger)
    r = await move(client, owner, await task_id(client, owner, board, "A"), foreign["columns"][0]["id"], 0)
    assert r.status_code == 403


async def test_wip_limit(client):
    owner, board, todo, doing, _ = await setup_board(client)
    await client.put(f"/api/columns/{doing}", json={"wip_limit": 1}, headers=owner["headers"])
    await make_task(client, owner, doing, "D")
    r = await client.post("/api/tasks/", json={"title": "E", "column_id": doing}, headers=owner["headers"])
    assert r.status_code == 409
    assert (await move(client, owner, await task_id(client, owner, board, "A"), doing, 0)).status_code == 409


async def test_delete_task_compacts_positions(client):
    owner, board, todo, *_ = await setup_board(client)
    tid = await task_id(client, owner, board, "A")
    assert (await client.delete(f"/api/tasks/{tid}", headers=owner["headers"])).status_code == 204
    board_data = (await client.get(f"/api/boards/{board['id']}", headers=owner["headers"])).json()
    assert [(t["title"], t["position"]) for t in board_data["columns"][0]["tasks"]] == [("B", 0), ("C", 1)]


async def test_assignee_must_be_a_member(client):
    owner, board, todo, *_ = await setup_board(client)
    outsider = await signup(client)
    r = await client.post(
        "/api/tasks/",
        json={"title": "X", "column_id": todo, "assignee_id": outsider["user"]["id"]},
        headers=owner["headers"],
    )
    assert r.status_code == 422
    ok = await make_task(client, owner, todo, "Y", assignee_id=owner["user"]["id"], priority="high", labels=["api"])
    assert ok["assignee"]["id"] == owner["user"]["id"]
    bad_priority = await client.post(
        "/api/tasks/", json={"title": "Z", "column_id": todo, "priority": "urgent"}, headers=owner["headers"]
    )
    assert bad_priority.status_code == 422


async def test_comments(client):
    owner, board, todo, *_ = await setup_board(client)
    tid = await task_id(client, owner, board, "A")
    created = await client.post(
        "/api/comments/", json={"content": "Looks good", "task_id": tid}, headers=owner["headers"]
    )
    assert created.status_code == 201
    assert created.json()["author"]["id"] == owner["user"]["id"]
    assert (await client.get(f"/api/tasks/{tid}", headers=owner["headers"])).json()["comment_count"] == 1

    other = await signup(client)
    await client.post(
        f"/api/boards/{board['id']}/members", json={"email": other["user"]["email"]}, headers=owner["headers"]
    )
    forbidden = await client.delete(f"/api/comments/{created.json()['id']}", headers=other["headers"])
    assert forbidden.status_code == 403
    assert (await client.delete(f"/api/comments/{created.json()['id']}", headers=owner["headers"])).status_code == 204
