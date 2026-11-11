from tests.conftest import signup


async def test_register_login_me_refresh(client):
    alice = await signup(client, "alice")
    assert (await client.get("/api/auth/me", headers=alice["headers"])).json()["email"] == "alice@example.com"

    login = await client.post("/api/auth/login", json={"email": "ALICE@example.com", "password": "password123"})
    assert login.status_code == 200

    refreshed = await client.post("/api/auth/refresh", json={"refresh_token": alice["tokens"]["refresh_token"]})
    assert refreshed.status_code == 200


async def test_duplicate_email_is_409(client):
    await signup(client, "bob")
    r = await client.post(
        "/api/auth/register", json={"email": "Bob@Example.com", "username": "b2", "password": "password123"}
    )
    assert r.status_code == 409


async def test_bad_login_is_uniform_401(client):
    await signup(client, "carol")
    wrong = await client.post("/api/auth/login", json={"email": "carol@example.com", "password": "nope-nope"})
    unknown = await client.post("/api/auth/login", json={"email": "who@example.com", "password": "nope-nope"})
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json()


async def test_token_types_are_not_interchangeable(client):
    dave = await signup(client, "dave")
    refresh_as_access = {"Authorization": f"Bearer {dave['tokens']['refresh_token']}"}
    assert (await client.get("/api/auth/me", headers=refresh_as_access)).status_code == 401
    access_as_refresh = await client.post("/api/auth/refresh", json={"refresh_token": dave["tokens"]["access_token"]})
    assert access_as_refresh.status_code == 401


async def test_validation(client):
    bad_email = await client.post(
        "/api/auth/register", json={"email": "nope", "username": "x1", "password": "password123"}
    )
    short_pw = await client.post("/api/auth/register", json={"email": "e@x.io", "username": "x1", "password": "short"})
    assert bad_email.status_code == short_pw.status_code == 422
