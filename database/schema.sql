-- Esquema PostgreSQL de la aplicación de shōgi.
-- Equivale a los modelos de backend/app/models.py.
-- Uso: psql "$DATABASE_URL" -f database/schema.sql

BEGIN;

CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    username      VARCHAR(32)  NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_users_username ON users (username);

-- Tokens de sesión: solo se guarda el hash SHA-256 del token.
CREATE TABLE IF NOT EXISTS auth_tokens (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_auth_tokens_user_id ON auth_tokens (user_id);
CREATE INDEX IF NOT EXISTS ix_auth_tokens_token_hash ON auth_tokens (token_hash);

-- Progreso de aprendizaje: una fila por usuario.
-- lessons y puzzles: {"identificador": "fecha ISO de finalización"}.
CREATE TABLE IF NOT EXISTS progress (
    user_id      INTEGER     PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    lessons      JSON        NOT NULL DEFAULT '{}',
    puzzles      JSON        NOT NULL DEFAULT '{}',
    games_played INTEGER     NOT NULL DEFAULT 0 CHECK (games_played >= 0),
    games_won    INTEGER     NOT NULL DEFAULT 0 CHECK (games_won >= 0),
    games_lost   INTEGER     NOT NULL DEFAULT 0 CHECK (games_lost >= 0),
    games_drawn  INTEGER     NOT NULL DEFAULT 0 CHECK (games_drawn >= 0),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partidas guardadas: posición inicial en SFEN y movimientos en USI.
CREATE TABLE IF NOT EXISTS games (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    start_sfen VARCHAR(160) NOT NULL,
    moves      TEXT         NOT NULL DEFAULT '',
    winner     VARCHAR(5)   CHECK (winner IN ('sente', 'gote')),
    reason     VARCHAR(20)  CHECK (reason IN ('checkmate', 'no-moves', 'repetition', 'perpetual-check', 'resignation', 'impasse')),
    mode       VARCHAR(10)  NOT NULL DEFAULT 'ai' CHECK (mode IN ('ai', 'local')),
    difficulty VARCHAR(10)  CHECK (difficulty IN ('easy', 'normal', 'hard')),
    human_side VARCHAR(5)   CHECK (human_side IN ('sente', 'gote')),
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_games_user_id ON games (user_id);
CREATE INDEX IF NOT EXISTS ix_games_user_created ON games (user_id, created_at DESC);

COMMIT;
