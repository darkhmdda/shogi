import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

_SFEN_RANK = re.compile(r"^(\+?[KRBGSNLPkrbgsnlp]|[1-9])+$")
_USI_MOVE = re.compile(r"^([1-9][a-i][1-9][a-i]\+?|[RBGSNLP]\*[1-9][a-i])$")
_ID = re.compile(r"^[a-z0-9-]{1,64}$")


def validate_sfen(value: str) -> str:
    """Comprobación estructural de un SFEN (la legalidad la decide el motor del cliente)."""
    parts = value.strip().split()
    if len(parts) < 3:
        raise ValueError("SFEN incompleto")
    ranks = parts[0].split("/")
    if len(ranks) != 9 or not all(_SFEN_RANK.match(rank) for rank in ranks):
        raise ValueError("Tablero SFEN no válido")
    for rank in ranks:
        width = sum(int(ch) if ch.isdigit() else 1 for ch in rank.replace("+", ""))
        if width != 9:
            raise ValueError("Cada fila SFEN debe tener 9 casillas")
    if parts[1] not in ("b", "w"):
        raise ValueError("Turno SFEN no válido")
    if parts[2] != "-" and not re.fullmatch(r"(\d*[RBGSNLPrbgsnlp])+", parts[2]):
        raise ValueError("Mano SFEN no válida")
    return " ".join(parts)


class Credentials(BaseModel):
    username: str = Field(min_length=3, max_length=32, pattern=r"^[A-Za-z0-9_.-]+$")
    password: str = Field(min_length=8, max_length=128)


class TokenOut(BaseModel):
    token: str
    username: str


class UserOut(BaseModel):
    id: int
    username: str
    created_at: datetime


class GameCounters(BaseModel):
    played: int = Field(default=0, ge=0)
    won: int = Field(default=0, ge=0)
    lost: int = Field(default=0, ge=0)
    drawn: int = Field(default=0, ge=0)


class ProgressIn(BaseModel):
    lessons: dict[str, str] = Field(default_factory=dict)
    puzzles: dict[str, str] = Field(default_factory=dict)
    games: GameCounters = Field(default_factory=GameCounters)

    @field_validator("lessons", "puzzles")
    @classmethod
    def _check_ids(cls, value: dict[str, str]) -> dict[str, str]:
        if len(value) > 500:
            raise ValueError("Demasiadas entradas")
        for key in value:
            if not _ID.match(key):
                raise ValueError(f"Identificador no válido: {key}")
        return value


class ProgressOut(ProgressIn):
    updated_at: datetime | None = None


Owner = Literal["sente", "gote"]
Reason = Literal["checkmate", "no-moves", "repetition", "perpetual-check", "resignation", "impasse"]


class GameIn(BaseModel):
    sfen: str
    moves: list[str] = Field(default_factory=list, max_length=1000)
    winner: Owner | None = None
    reason: Reason | None = None
    mode: Literal["ai", "local"] = "ai"
    difficulty: Literal["easy", "normal", "hard"] | None = None
    human_side: Owner | None = None

    @field_validator("sfen")
    @classmethod
    def _check_sfen(cls, value: str) -> str:
        return validate_sfen(value)

    @field_validator("moves")
    @classmethod
    def _check_moves(cls, value: list[str]) -> list[str]:
        for move in value:
            if not _USI_MOVE.match(move):
                raise ValueError(f"Movimiento USI no válido: {move}")
        return value


class GameOut(GameIn):
    id: int
    created_at: datetime
