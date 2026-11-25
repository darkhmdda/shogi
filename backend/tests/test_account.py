from app.ratelimit import login_limiter


def creds(password="contraseña-segura"):
    return {"username": "haru", "password": password}


def test_login_is_rate_limited(client, auth):
    login_limiter._failures.clear()
    for _ in range(5):
        assert client.post("/auth/login", json=creds("incorrecta1")).status_code == 401
    blocked = client.post("/auth/login", json=creds())
    assert blocked.status_code == 429
    assert int(blocked.headers["Retry-After"]) > 0
    login_limiter._failures.clear()
    assert client.post("/auth/login", json=creds()).status_code == 200


def test_successful_login_resets_failures(client, auth):
    login_limiter._failures.clear()
    for _ in range(4):
        client.post("/auth/login", json=creds("incorrecta1"))
    assert client.post("/auth/login", json=creds()).status_code == 200
    for _ in range(4):
        assert client.post("/auth/login", json=creds("incorrecta1")).status_code == 401
    login_limiter._failures.clear()


def test_change_password_closes_other_sessions(client, auth):
    other = {"Authorization": f"Bearer {client.post('/auth/login', json=creds()).json()['token']}"}

    wrong = client.post("/auth/password", json={"current_password": "mal", "new_password": "nueva-clave-123"}, headers=auth)
    assert wrong.status_code == 403

    changed = client.post(
        "/auth/password", json={"current_password": "contraseña-segura", "new_password": "nueva-clave-123"}, headers=auth
    )
    assert changed.status_code == 200
    fresh = {"Authorization": f"Bearer {changed.json()['token']}"}

    assert client.get("/auth/me", headers=auth).status_code == 401
    assert client.get("/auth/me", headers=other).status_code == 401
    assert client.get("/auth/me", headers=fresh).status_code == 200
    login_limiter._failures.clear()
    assert client.post("/auth/login", json=creds("nueva-clave-123")).status_code == 200


def test_delete_account_removes_everything(client, auth):
    client.put("/progress", json={"lessons": {"mate": "2026-01-01"}}, headers=auth)
    client.post("/games", json={"sfen": "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1"}, headers=auth)

    assert client.post("/auth/delete", json={"password": "mal"}, headers=auth).status_code == 403
    assert client.post("/auth/delete", json={"password": "contraseña-segura"}, headers=auth).status_code == 204

    assert client.get("/auth/me", headers=auth).status_code == 401
    login_limiter._failures.clear()
    assert client.post("/auth/login", json=creds()).status_code == 401
    # El nombre vuelve a estar libre.
    assert client.post("/auth/register", json=creds()).status_code == 201
    login_limiter._failures.clear()
