"""Esquema inicial: usuarios, sesiones, progreso y partidas.

Revision ID: 0001
Revises:
Create Date: 2026-11-25
"""

import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("username", sa.String(32), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_users_username", "users", ["username"], unique=True)

    op.create_table(
        "auth_tokens",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_auth_tokens_user_id", "auth_tokens", ["user_id"])
    op.create_index("ix_auth_tokens_token_hash", "auth_tokens", ["token_hash"], unique=True)

    op.create_table(
        "progress",
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("lessons", sa.JSON(), nullable=False),
        sa.Column("puzzles", sa.JSON(), nullable=False),
        sa.Column("games_played", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("games_won", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("games_lost", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("games_drawn", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "games_played >= 0 AND games_won >= 0 AND games_lost >= 0 AND games_drawn >= 0",
            name="ck_progress_counters",
        ),
    )

    op.create_table(
        "games",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("start_sfen", sa.String(160), nullable=False),
        sa.Column("moves", sa.Text(), nullable=False, server_default=""),
        sa.Column("winner", sa.String(5)),
        sa.Column("reason", sa.String(20)),
        sa.Column("mode", sa.String(10), nullable=False, server_default="ai"),
        sa.Column("difficulty", sa.String(10)),
        sa.Column("human_side", sa.String(5)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("winner IN ('sente', 'gote')", name="ck_games_winner"),
        sa.CheckConstraint(
            "reason IN ('checkmate', 'no-moves', 'repetition', 'perpetual-check', 'resignation', 'impasse')",
            name="ck_games_reason",
        ),
        sa.CheckConstraint("mode IN ('ai', 'local')", name="ck_games_mode"),
        sa.CheckConstraint("difficulty IN ('easy', 'normal', 'hard')", name="ck_games_difficulty"),
        sa.CheckConstraint("human_side IN ('sente', 'gote')", name="ck_games_human_side"),
    )
    op.create_index("ix_games_user_id", "games", ["user_id"])
    op.create_index("ix_games_user_created", "games", ["user_id", "created_at"])


def downgrade() -> None:
    op.drop_table("games")
    op.drop_table("progress")
    op.drop_table("auth_tokens")
    op.drop_table("users")
