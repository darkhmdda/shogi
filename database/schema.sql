-- Esquema PostgreSQL de la aplicación de shōgi.
-- ARCHIVO GENERADO: no editar a mano. Fuente: backend/migrations (Alembic).
-- Regenerar con: cd backend && ./scripts/generate_schema.sh

BEGIN;

CREATE TABLE alembic_version (
    version_num VARCHAR(32) NOT NULL, 
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);

-- Running upgrade  -> 0001

CREATE TABLE users (
    id SERIAL NOT NULL, 
    username VARCHAR(32) NOT NULL, 
    password_hash VARCHAR(255) NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id)
);

CREATE UNIQUE INDEX ix_users_username ON users (username);

CREATE TABLE auth_tokens (
    id SERIAL NOT NULL, 
    user_id INTEGER NOT NULL, 
    token_hash VARCHAR(64) NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX ix_auth_tokens_user_id ON auth_tokens (user_id);

CREATE UNIQUE INDEX ix_auth_tokens_token_hash ON auth_tokens (token_hash);

CREATE TABLE progress (
    user_id INTEGER NOT NULL, 
    lessons JSON NOT NULL, 
    puzzles JSON NOT NULL, 
    games_played INTEGER DEFAULT '0' NOT NULL, 
    games_won INTEGER DEFAULT '0' NOT NULL, 
    games_lost INTEGER DEFAULT '0' NOT NULL, 
    games_drawn INTEGER DEFAULT '0' NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (user_id), 
    CONSTRAINT ck_progress_counters CHECK (games_played >= 0 AND games_won >= 0 AND games_lost >= 0 AND games_drawn >= 0), 
    FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE games (
    id SERIAL NOT NULL, 
    user_id INTEGER NOT NULL, 
    start_sfen VARCHAR(160) NOT NULL, 
    moves TEXT DEFAULT '' NOT NULL, 
    winner VARCHAR(5), 
    reason VARCHAR(20), 
    mode VARCHAR(10) DEFAULT 'ai' NOT NULL, 
    difficulty VARCHAR(10), 
    human_side VARCHAR(5), 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    CONSTRAINT ck_games_winner CHECK (winner IN ('sente', 'gote')), 
    CONSTRAINT ck_games_reason CHECK (reason IN ('checkmate', 'no-moves', 'repetition', 'perpetual-check', 'resignation', 'impasse')), 
    CONSTRAINT ck_games_mode CHECK (mode IN ('ai', 'local')), 
    CONSTRAINT ck_games_difficulty CHECK (difficulty IN ('easy', 'normal', 'hard')), 
    CONSTRAINT ck_games_human_side CHECK (human_side IN ('sente', 'gote')), 
    FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX ix_games_user_id ON games (user_id);

CREATE INDEX ix_games_user_created ON games (user_id, created_at);

INSERT INTO alembic_version (version_num) VALUES ('0001') RETURNING alembic_version.version_num;

-- Running upgrade 0001 -> 0002

CREATE TABLE online_games (
    id SERIAL NOT NULL, 
    code VARCHAR(8) NOT NULL, 
    sente_id INTEGER, 
    gote_id INTEGER, 
    start_sfen VARCHAR(160) NOT NULL, 
    moves TEXT DEFAULT '' NOT NULL, 
    status VARCHAR(10) DEFAULT 'waiting' NOT NULL, 
    winner VARCHAR(5), 
    reason VARCHAR(20), 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    CONSTRAINT ck_online_status CHECK (status IN ('waiting', 'active', 'finished')), 
    CONSTRAINT ck_online_winner CHECK (winner IN ('sente', 'gote')), 
    FOREIGN KEY(sente_id) REFERENCES users (id) ON DELETE SET NULL, 
    FOREIGN KEY(gote_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX ix_online_games_code ON online_games (code);

CREATE INDEX ix_online_games_sente ON online_games (sente_id);

CREATE INDEX ix_online_games_gote ON online_games (gote_id);

UPDATE alembic_version SET version_num='0002' WHERE alembic_version.version_num = '0001';

COMMIT;

