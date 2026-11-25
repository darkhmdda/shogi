INITIAL = "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1"


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_register_login_and_me(client, auth):
    me = client.get("/auth/me", headers=auth)
    assert me.status_code == 200
    assert me.json()["username"] == "haru"

    duplicate = client.post("/auth/register", json={"username": "HARU", "password": "otra-contraseña"})
    assert duplicate.status_code == 409

    bad = client.post("/auth/login", json={"username": "haru", "password": "incorrecta1"})
    assert bad.status_code == 401

    good = client.post("/auth/login", json={"username": "haru", "password": "contraseña-segura"})
    assert good.status_code == 200 and good.json()["token"]


def test_rejects_weak_credentials(client):
    assert client.post("/auth/register", json={"username": "a", "password": "corta"}).status_code == 422


def test_requires_token(client):
    assert client.get("/progress").status_code == 401
    assert client.get("/progress", headers={"Authorization": "Bearer inventado"}).status_code == 401


def test_logout_revokes_token(client, auth):
    assert client.post("/auth/logout", headers=auth).status_code == 204
    assert client.get("/auth/me", headers=auth).status_code == 401


def test_progress_merges_without_losing_data(client, auth):
    empty = client.get("/progress", headers=auth).json()
    assert empty["lessons"] == {} and empty["games"]["played"] == 0

    first = {
        "lessons": {"first-steps": "2026-11-20T10:00:00Z"},
        "puzzles": {"m1-atama-kin": "2026-11-21T10:00:00Z"},
        "games": {"played": 3, "won": 2, "lost": 1, "drawn": 0},
    }
    client.put("/progress", json=first, headers=auth)

    # Otro dispositivo con menos partidas y una lección distinta.
    second = {
        "lessons": {"first-steps": "2026-11-22T10:00:00Z", "mate": "2026-11-23T10:00:00Z"},
        "puzzles": {},
        "games": {"played": 1, "won": 1, "lost": 0, "drawn": 0},
    }
    merged = client.put("/progress", json=second, headers=auth).json()

    assert merged["lessons"] == {"first-steps": "2026-11-20T10:00:00Z", "mate": "2026-11-23T10:00:00Z"}
    assert merged["puzzles"] == {"m1-atama-kin": "2026-11-21T10:00:00Z"}
    assert merged["games"] == {"played": 3, "won": 2, "lost": 1, "drawn": 0}


def test_progress_rejects_bad_ids(client, auth):
    response = client.put("/progress", json={"lessons": {"<script>": "x"}}, headers=auth)
    assert response.status_code == 422


def test_save_and_list_games(client, auth):
    game = {
        "sfen": INITIAL,
        "moves": ["7g7f", "3c3d", "8h2b+", "3a2b", "B*4e"],
        "winner": "sente",
        "reason": "resignation",
        "mode": "ai",
        "difficulty": "hard",
        "human_side": "sente",
    }
    created = client.post("/games", json=game, headers=auth)
    assert created.status_code == 201
    game_id = created.json()["id"]

    client.post("/games", json={**game, "winner": "gote"}, headers=auth)
    client.post("/games", json={**game, "winner": None, "reason": "repetition"}, headers=auth)

    games = client.get("/games", headers=auth).json()
    assert len(games) == 3
    assert client.get(f"/games/{game_id}", headers=auth).json()["moves"] == game["moves"]
    assert client.get("/games/stats", headers=auth).json() == {"total": 3, "won": 1, "lost": 1, "drawn": 1}

    assert client.delete(f"/games/{game_id}", headers=auth).status_code == 204
    assert client.get(f"/games/{game_id}", headers=auth).status_code == 404


def test_games_are_private(client, auth):
    created = client.post("/games", json={"sfen": INITIAL, "moves": []}, headers=auth).json()
    other = client.post("/auth/register", json={"username": "kei", "password": "otra-contraseña"}).json()
    headers = {"Authorization": f"Bearer {other['token']}"}
    assert client.get(f"/games/{created['id']}", headers=headers).status_code == 404
    assert client.get("/games", headers=headers).json() == []


def test_rejects_invalid_game_data(client, auth):
    bad_sfen = client.post("/games", json={"sfen": "9/9/9 b - 1", "moves": []}, headers=auth)
    assert bad_sfen.status_code == 422
    bad_move = client.post("/games", json={"sfen": INITIAL, "moves": ["7g7z"]}, headers=auth)
    assert bad_move.status_code == 422
