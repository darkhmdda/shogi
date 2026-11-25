from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..db import get_session
from ..models import Progress, User
from ..schemas import GameCounters, ProgressIn, ProgressOut
from ..security import current_user

router = APIRouter(prefix="/progress", tags=["progreso"])


def _to_out(progress: Progress) -> ProgressOut:
    return ProgressOut(
        lessons=progress.lessons or {},
        puzzles=progress.puzzles or {},
        games=GameCounters(
            played=progress.games_played,
            won=progress.games_won,
            lost=progress.games_lost,
            drawn=progress.games_drawn,
        ),
        updated_at=progress.updated_at,
    )


def _get_or_create(session: Session, user: User) -> Progress:
    if user.progress is None:
        user.progress = Progress(lessons={}, puzzles={})
        session.commit()
    return user.progress


@router.get("", response_model=ProgressOut)
def read_progress(user: User = Depends(current_user), session: Session = Depends(get_session)) -> ProgressOut:
    return _to_out(_get_or_create(session, user))


@router.put("", response_model=ProgressOut)
def merge_progress(
    data: ProgressIn, user: User = Depends(current_user), session: Session = Depends(get_session)
) -> ProgressOut:
    """
    Fusiona el progreso del dispositivo con el del servidor, para que usar
    la app sin conexión en varios dispositivos nunca borre avances:
    se unen lecciones y problemas (conservando la fecha más antigua) y los
    contadores de partidas toman el valor máximo.
    """
    progress = _get_or_create(session, user)

    def union(current: dict[str, str], incoming: dict[str, str]) -> dict[str, str]:
        merged = dict(current or {})
        for key, date in incoming.items():
            merged[key] = min(merged[key], date) if key in merged else date
        return merged

    progress.lessons = union(progress.lessons, data.lessons)
    progress.puzzles = union(progress.puzzles, data.puzzles)
    progress.games_played = max(progress.games_played, data.games.played)
    progress.games_won = max(progress.games_won, data.games.won)
    progress.games_lost = max(progress.games_lost, data.games.lost)
    progress.games_drawn = max(progress.games_drawn, data.games.drawn)
    session.commit()
    session.refresh(progress)
    return _to_out(progress)
