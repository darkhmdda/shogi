"""Partidas en línea: crear, unirse, jugar y seguir la partida en tiempo real."""

import asyncio
import secrets
from collections import defaultdict
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from .. import shogi
from ..db import SessionLocal, get_session
from ..models import OnlineGame, User
from ..security import current_user, user_for_token

router = APIRouter(prefix="/online", tags=["en línea"])

# Sin 0/O ni 1/I para que los códigos se dicten sin confusiones.
_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


class CreateIn(BaseModel):
    side: Literal["sente", "gote", "random"] = "random"


class MoveIn(BaseModel):
    move: str = Field(min_length=4, max_length=5)
    # Número de jugadas que el cliente cree que hay: evita jugadas duplicadas o desfasadas.
    ply: int = Field(ge=0)


class OnlineState(BaseModel):
    code: str
    sfen: str
    moves: list[str]
    status: Literal["waiting", "active", "finished"]
    sente: str | None
    gote: str | None
    winner: Literal["sente", "gote"] | None
    reason: str | None
    your_side: Literal["sente", "gote"] | None = None


def _state(game: OnlineGame, user: User | None = None) -> OnlineState:
    side = None
    if user is not None:
        if game.sente_id == user.id:
            side = "sente"
        elif game.gote_id == user.id:
            side = "gote"
    return OnlineState(
        code=game.code,
        sfen=game.start_sfen,
        moves=game.moves.split() if game.moves else [],
        status=game.status,
        sente=game.sente.username if game.sente else None,
        gote=game.gote.username if game.gote else None,
        winner=game.winner,
        reason=game.reason,
        your_side=side,
    )


class _Hub:
    """Conexiones WebSocket por partida (un solo proceso)."""

    def __init__(self) -> None:
        self.rooms: dict[str, set[WebSocket]] = defaultdict(set)

    async def broadcast(self, code: str, state: OnlineState) -> None:
        payload = state.model_dump()
        for socket in list(self.rooms.get(code, ())):
            try:
                await socket.send_json({**payload, "your_side": None})
            except Exception:  # noqa: BLE001 — conexión cerrada
                self.rooms[code].discard(socket)


hub = _Hub()


def _find(session: Session, code: str) -> OnlineGame:
    game = session.scalar(select(OnlineGame).where(OnlineGame.code == code.upper()))
    if game is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Partida no encontrada.")
    return game


def _side_of(game: OnlineGame, user: User) -> str:
    if game.sente_id == user.id:
        return "sente"
    if game.gote_id == user.id:
        return "gote"
    raise HTTPException(status.HTTP_403_FORBIDDEN, "No juegas esta partida.")


@router.post("", response_model=OnlineState, status_code=status.HTTP_201_CREATED)
def create_game(
    data: CreateIn, user: User = Depends(current_user), session: Session = Depends(get_session)
) -> OnlineState:
    side = data.side if data.side != "random" else secrets.choice(["sente", "gote"])
    while True:
        code = "".join(secrets.choice(_ALPHABET) for _ in range(6))
        if session.scalar(select(OnlineGame.id).where(OnlineGame.code == code)) is None:
            break
    game = OnlineGame(code=code, start_sfen=shogi.INITIAL_SFEN, moves="", status="waiting")
    if side == "sente":
        game.sente_id = user.id
    else:
        game.gote_id = user.id
    session.add(game)
    session.commit()
    session.refresh(game)
    return _state(game, user)


@router.get("", response_model=list[OnlineState])
def my_games(user: User = Depends(current_user), session: Session = Depends(get_session)) -> list[OnlineState]:
    games = session.scalars(
        select(OnlineGame)
        .where(or_(OnlineGame.sente_id == user.id, OnlineGame.gote_id == user.id))
        .order_by(OnlineGame.updated_at.desc(), OnlineGame.id.desc())
        .limit(20)
    )
    return [_state(game, user) for game in games]


@router.get("/{code}", response_model=OnlineState)
def read_game(code: str, user: User = Depends(current_user), session: Session = Depends(get_session)) -> OnlineState:
    return _state(_find(session, code), user)


@router.post("/{code}/join", response_model=OnlineState)
async def join_game(
    code: str, user: User = Depends(current_user), session: Session = Depends(get_session)
) -> OnlineState:
    game = _find(session, code)
    if user.id in (game.sente_id, game.gote_id):
        return _state(game, user)
    if game.status != "waiting":
        raise HTTPException(status.HTTP_409_CONFLICT, "La partida ya tiene dos jugadores.")
    if game.sente_id is None:
        game.sente_id = user.id
    else:
        game.gote_id = user.id
    game.status = "active"
    session.commit()
    session.refresh(game)
    await hub.broadcast(game.code, _state(game))
    return _state(game, user)


@router.post("/{code}/move", response_model=OnlineState)
async def play(
    code: str, data: MoveIn, user: User = Depends(current_user), session: Session = Depends(get_session)
) -> OnlineState:
    game = _find(session, code)
    side = _side_of(game, user)
    if game.status != "active":
        raise HTTPException(status.HTTP_409_CONFLICT, "La partida no está en curso.")

    moves = game.moves.split() if game.moves else []
    if data.ply != len(moves):
        raise HTTPException(status.HTTP_409_CONFLICT, "La partida ha cambiado: actualiza el tablero.")
    first = shogi.SENTE if game.start_sfen.split()[1] == "b" else shogi.GOTE
    turn = first if len(moves) % 2 == 0 else shogi.other(first)
    if turn != side:
        raise HTTPException(status.HTTP_409_CONFLICT, "No es tu turno.")

    try:
        result = shogi.replay(game.start_sfen, [*moves, data.move])
    except shogi.IllegalMove as error:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(error)) from error

    game.moves = " ".join([*moves, data.move])
    if result.reason is not None:
        game.status, game.winner, game.reason = "finished", result.winner, result.reason
    session.commit()
    session.refresh(game)
    await hub.broadcast(game.code, _state(game))
    return _state(game, user)


@router.post("/{code}/resign", response_model=OnlineState)
async def resign(code: str, user: User = Depends(current_user), session: Session = Depends(get_session)) -> OnlineState:
    game = _find(session, code)
    side = _side_of(game, user)
    if game.status == "finished":
        raise HTTPException(status.HTTP_409_CONFLICT, "La partida ya ha terminado.")
    game.status = "finished"
    game.reason = "resignation"
    # Abandonar antes de que llegue el rival simplemente cancela la partida.
    game.winner = shogi.other(side) if (game.sente_id and game.gote_id) else None
    session.commit()
    session.refresh(game)
    await hub.broadcast(game.code, _state(game))
    return _state(game, user)


@router.websocket("/{code}/ws")
async def watch(websocket: WebSocket, code: str, token: str) -> None:
    """Envía el estado de la partida cada vez que cambia. Autenticación: ?token=..."""
    with SessionLocal() as session:
        user = user_for_token(session, token)
        game = session.scalar(select(OnlineGame).where(OnlineGame.code == code.upper()))
        if user is None or game is None:
            await websocket.close(code=4401 if user is None else 4404)
            return
        initial = _state(game, user)

    await websocket.accept()
    room = hub.rooms[initial.code]
    room.add(websocket)
    try:
        await websocket.send_json(initial.model_dump())
        while True:
            # El cliente puede enviar "ping"; no se esperan otros mensajes.
            await asyncio.wait_for(websocket.receive_text(), timeout=120)
    except (WebSocketDisconnect, asyncio.TimeoutError):
        pass
    finally:
        room.discard(websocket)
