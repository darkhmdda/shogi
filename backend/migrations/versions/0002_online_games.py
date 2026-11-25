"""Partidas en línea entre usuarios.

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-25
"""

import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "online_games",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("code", sa.String(8), nullable=False),
        sa.Column("sente_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("gote_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("start_sfen", sa.String(160), nullable=False),
        sa.Column("moves", sa.Text(), nullable=False, server_default=""),
        sa.Column("status", sa.String(10), nullable=False, server_default="waiting"),
        sa.Column("winner", sa.String(5)),
        sa.Column("reason", sa.String(20)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("status IN ('waiting', 'active', 'finished')", name="ck_online_status"),
        sa.CheckConstraint("winner IN ('sente', 'gote')", name="ck_online_winner"),
    )
    op.create_index("ix_online_games_code", "online_games", ["code"], unique=True)
    op.create_index("ix_online_games_sente", "online_games", ["sente_id"])
    op.create_index("ix_online_games_gote", "online_games", ["gote_id"])


def downgrade() -> None:
    op.drop_table("online_games")
