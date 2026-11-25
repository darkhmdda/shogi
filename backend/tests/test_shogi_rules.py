import pytest

from app.shogi import INITIAL_SFEN, IllegalMove, apply_move, from_sfen, legal_moves, replay, to_sfen, to_usi


def perft(position, depth):
    if depth == 0:
        return 1
    return sum(perft(apply_move(position, move), depth - 1) for move in legal_moves(position))


def test_perft_matches_typescript_engine():
    start = from_sfen(INITIAL_SFEN)
    assert perft(start, 1) == 30
    assert perft(start, 2) == 900
    assert perft(start, 3) == 25470


def test_sfen_round_trip():
    sfen = "8l/1r5+P1/p1+Bpkp3/6p1p/9/9/9/9/4K4 w 2Pb3g 40"
    assert to_sfen(from_sfen(sfen), 40) == sfen


def test_uchifuzume_is_illegal():
    position = from_sfen("k8/2S6/G8/9/9/9/9/9/8K b GP 1")
    usi = {to_usi(move) for move in legal_moves(position)}
    assert "P*9b" not in usi
    assert "G*9b" in usi


def test_nifu_is_illegal():
    position = from_sfen("4k4/9/9/9/9/9/4P4/9/4K4 b P 1")
    usi = {to_usi(move) for move in legal_moves(position)}
    assert not any(m.startswith("P*5") for m in usi)
    assert "P*4e" in usi


def test_replay_detects_checkmate():
    result = replay("4k4/9/4P4/9/9/9/9/9/4K4 b G 1", ["G*5b"])
    assert (result.winner, result.reason) == ("sente", "checkmate")


def test_replay_rejects_illegal_moves():
    with pytest.raises(IllegalMove):
        replay(INITIAL_SFEN, ["7g7f", "7g7f"])
    with pytest.raises(IllegalMove):
        replay(INITIAL_SFEN, ["zz"])


def test_replay_repetition_and_perpetual_check():
    shuffle = ["2h3h", "8b7b", "3h2h", "7b8b"] * 3
    assert replay(INITIAL_SFEN, shuffle).reason == "repetition"

    perpetual = ["8e9e", "9a8a", "9e8e", "8a9a"] * 3
    result = replay("k8/9/9/9/1R7/9/9/9/8K b - 1", perpetual)
    assert (result.winner, result.reason) == ("gote", "perpetual-check")
