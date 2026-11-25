def register(client, name):
    token = client.post("/auth/register", json={"username": name, "password": "contraseña-segura"}).json()["token"]
    return {"Authorization": f"Bearer {token}"}, token


def start_game(client):
    alice, alice_token = register(client, "alice")
    bob, bob_token = register(client, "bob")
    created = client.post("/online", json={"side": "sente"}, headers=alice).json()
    assert created["status"] == "waiting" and created["your_side"] == "sente"
    joined = client.post(f"/online/{created['code']}/join", headers=bob).json()
    assert joined["status"] == "active" and joined["your_side"] == "gote"
    return created["code"], alice, bob, alice_token, bob_token


def test_create_join_and_play(client):
    code, alice, bob, *_ = start_game(client)

    ok = client.post(f"/online/{code}/move", json={"move": "7g7f", "ply": 0}, headers=alice)
    assert ok.status_code == 200 and ok.json()["moves"] == ["7g7f"]

    not_your_turn = client.post(f"/online/{code}/move", json={"move": "2g2f", "ply": 1}, headers=alice)
    assert not_your_turn.status_code == 409

    stale = client.post(f"/online/{code}/move", json={"move": "3c3d", "ply": 0}, headers=bob)
    assert stale.status_code == 409

    illegal = client.post(f"/online/{code}/move", json={"move": "3c3e", "ply": 1}, headers=bob)
    assert illegal.status_code == 422

    assert client.post(f"/online/{code}/move", json={"move": "3c3d", "ply": 1}, headers=bob).status_code == 200
    state = client.get(f"/online/{code}", headers=alice).json()
    assert state["moves"] == ["7g7f", "3c3d"] and state["sente"] == "alice" and state["gote"] == "bob"


def test_resign_finishes_the_game(client):
    code, alice, bob, *_ = start_game(client)
    # Intercambio de alfiles con promoción; las reglas completas se prueban en test_shogi_rules.py.
    sequence = ["7g7f", "3c3d", "8h2b+", "4a4b", "2b3a"]
    for ply, move in enumerate(sequence):
        headers = alice if ply % 2 == 0 else bob
        response = client.post(f"/online/{code}/move", json={"move": move, "ply": ply}, headers=headers)
        assert response.status_code == 200, response.json()
    # No es mate: Gote abandona.
    resigned = client.post(f"/online/{code}/resign", headers=bob).json()
    assert resigned["status"] == "finished" and resigned["winner"] == "sente"
    assert client.post(f"/online/{code}/move", json={"move": "2g2f", "ply": 5}, headers=alice).status_code == 409


def test_third_player_cannot_join_or_move(client):
    code, *_ = start_game(client)
    carol, _ = register(client, "carol")
    assert client.post(f"/online/{code}/join", headers=carol).status_code == 409
    assert client.post(f"/online/{code}/move", json={"move": "7g7f", "ply": 0}, headers=carol).status_code == 403
    assert client.get("/online/ZZZZZZ", headers=carol).status_code == 404


def test_my_games_lists_active_games(client):
    code, alice, *_ = start_game(client)
    games = client.get("/online", headers=alice).json()
    assert [g["code"] for g in games] == [code]


def test_websocket_receives_updates(client):
    code, alice, bob, alice_token, _ = start_game(client)
    with client.websocket_connect(f"/online/{code}/ws?token={alice_token}") as socket:
        first = socket.receive_json()
        assert first["status"] == "active" and first["your_side"] == "sente"
        client.post(f"/online/{code}/move", json={"move": "7g7f", "ply": 0}, headers=alice)
        update = socket.receive_json()
        assert update["moves"] == ["7g7f"]


def test_websocket_rejects_bad_token(client):
    code, *_ = start_game(client)
    import pytest
    from starlette.websockets import WebSocketDisconnect

    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect(f"/online/{code}/ws?token=falso") as socket:
            socket.receive_json()
