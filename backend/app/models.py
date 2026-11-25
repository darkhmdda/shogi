from datetime import datetime, timezone

from sqlalchemy import JSON, CheckConstraint, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    progress: Mapped["Progress | None"] = relationship(back_populates="user", cascade="all, delete-orphan")
    games: Mapped[list["Game"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class AuthToken(Base):
    __tablename__ = "auth_tokens"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship()


class Progress(Base):
    __tablename__ = "progress"
    __table_args__ = (
        CheckConstraint(
            "games_played >= 0 AND games_won >= 0 AND games_lost >= 0 AND games_drawn >= 0",
            name="ck_progress_counters",
        ),
    )

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    # {"lesson-id": "fecha ISO"} para lecciones y problemas resueltos.
    lessons: Mapped[dict] = mapped_column(JSON, default=dict)
    puzzles: Mapped[dict] = mapped_column(JSON, default=dict)
    games_played: Mapped[int] = mapped_column(Integer, default=0)
    games_won: Mapped[int] = mapped_column(Integer, default=0)
    games_lost: Mapped[int] = mapped_column(Integer, default=0)
    games_drawn: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    user: Mapped[User] = relationship(back_populates="progress")


class Game(Base):
    __tablename__ = "games"
    __table_args__ = (
        Index("ix_games_user_created", "user_id", "created_at"),
        CheckConstraint("winner IN ('sente', 'gote')", name="ck_games_winner"),
        CheckConstraint(
            "reason IN ('checkmate', 'no-moves', 'repetition', 'perpetual-check', 'resignation', 'impasse')",
            name="ck_games_reason",
        ),
        CheckConstraint("mode IN ('ai', 'local')", name="ck_games_mode"),
        CheckConstraint("difficulty IN ('easy', 'normal', 'hard')", name="ck_games_difficulty"),
        CheckConstraint("human_side IN ('sente', 'gote')", name="ck_games_human_side"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    start_sfen: Mapped[str] = mapped_column(String(160))
    moves: Mapped[str] = mapped_column(Text, default="")  # Movimientos USI separados por espacios.
    winner: Mapped[str | None] = mapped_column(String(5), nullable=True)  # "sente", "gote" o None.
    reason: Mapped[str | None] = mapped_column(String(20), nullable=True)
    mode: Mapped[str] = mapped_column(String(10), default="ai")
    difficulty: Mapped[str | None] = mapped_column(String(10), nullable=True)
    human_side: Mapped[str | None] = mapped_column(String(5), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped[User] = relationship(back_populates="games")


class OnlineGame(Base):
    """Partida en línea entre dos usuarios. El servidor valida cada jugada."""

    __tablename__ = "online_games"
    __table_args__ = (
        CheckConstraint("status IN ('waiting', 'active', 'finished')", name="ck_online_status"),
        CheckConstraint("winner IN ('sente', 'gote')", name="ck_online_winner"),
        Index("ix_online_games_sente", "sente_id"),
        Index("ix_online_games_gote", "gote_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(8), unique=True, index=True)
    sente_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    gote_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    start_sfen: Mapped[str] = mapped_column(String(160))
    moves: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(10), default="waiting")
    winner: Mapped[str | None] = mapped_column(String(5), nullable=True)
    reason: Mapped[str | None] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    sente: Mapped[User | None] = relationship(foreign_keys=[sente_id])
    gote: Mapped[User | None] = relationship(foreign_keys=[gote_id])
