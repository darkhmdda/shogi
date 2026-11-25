from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_session
from ..models import Game, User
from ..schemas import GameIn, GameOut
from ..security import current_user

router = APIRouter(prefix="/games", tags=["partidas"])


def _to_out(game: Game) -> GameOut:
    return GameOut(
        id=game.id,
        sfen=game.start_sfen,
        moves=game.moves.split() if game.moves else [],
        winner=game.winner,
        reason=game.reason,
        mode=game.mode,
        difficulty=game.difficulty,
        human_side=game.human_side,
        created_at=game.created_at,
    )


@router.post("", response_model=GameOut, status_code=status.HTTP_201_CREATED)
def save_game(data: GameIn, user: User = Depends(current_user), session: Session = Depends(get_session)) -> GameOut:
    game = Game(
        user_id=user.id,
        start_sfen=data.sfen,
        moves=" ".join(data.moves),
        winner=data.winner,
        reason=data.reason,
        mode=data.mode,
        difficulty=data.difficulty,
        human_side=data.human_side,
    )
    session.add(game)
    session.commit()
    session.refresh(game)
    return _to_out(game)


@router.get("", response_model=list[GameOut])
def list_games(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
) -> list[GameOut]:
    games = session.scalars(
        select(Game).where(Game.user_id == user.id).order_by(Game.created_at.desc(), Game.id.desc()).limit(limit).offset(offset)
    )
    return [_to_out(game) for game in games]


@router.get("/stats")
def game_stats(user: User = Depends(current_user), session: Session = Depends(get_session)) -> dict[str, int]:
    """Resumen de las partidas guardadas contra la máquina."""
    rows = session.execute(
        select(Game.winner, Game.human_side, func.count())
        .where(Game.user_id == user.id, Game.mode == "ai")
        .group_by(Game.winner, Game.human_side)
    ).all()
    stats = {"total": 0, "won": 0, "lost": 0, "drawn": 0}
    for winner, side, count in rows:
        stats["total"] += count
        if winner is None:
            stats["drawn"] += count
        elif winner == side:
            stats["won"] += count
        else:
            stats["lost"] += count
    return stats


def _owned(session: Session, user: User, game_id: int) -> Game:
    game = session.get(Game, game_id)
    if game is None or game.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Partida no encontrada.")
    return game


@router.get("/{game_id}", response_model=GameOut)
def read_game(game_id: int, user: User = Depends(current_user), session: Session = Depends(get_session)) -> GameOut:
    return _to_out(_owned(session, user, game_id))


@router.delete("/{game_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_game(game_id: int, user: User = Depends(current_user), session: Session = Depends(get_session)) -> None:
    session.delete(_owned(session, user, game_id))
    session.commit()
