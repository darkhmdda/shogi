# Backend — Shōgi API

API en **FastAPI** + **SQLAlchemy 2** sobre **PostgreSQL** (SQLite para desarrollo
y tests). Gestiona cuentas, sincroniza el progreso de aprendizaje entre
dispositivos y guarda partidas.

## Arrancar en local

```bash
cd backend
python3 -m venv .venv && . .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

Sin `DATABASE_URL` usa SQLite (`shogi.db`). Documentación interactiva en
<http://localhost:8000/docs>.

| Variable | Por defecto | Descripción |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./shogi.db` | `postgresql://usuario:clave@host/base` en producción |
| `SHOGI_CORS_ORIGINS` | `http://localhost:5173,http://localhost:4173` | Orígenes permitidos para la web |
| `SHOGI_TOKEN_DAYS` | `30` | Duración de las sesiones |
| `SHOGI_AUTO_CREATE` | `1` | Crear tablas al arrancar (desarrollo); `0` con migraciones |

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/health` | Estado del servicio |
| POST | `/auth/register` | Crear cuenta → token |
| POST | `/auth/login` | Iniciar sesión → token |
| POST | `/auth/logout` | Cerrar sesión |
| GET | `/auth/me` | Usuario actual |
| GET | `/progress` | Progreso guardado |
| PUT | `/progress` | Fusionar el progreso del dispositivo (nunca borra avances) |
| POST | `/games` | Guardar una partida (SFEN + movimientos USI) |
| GET | `/games` | Listar partidas |
| GET | `/games/stats` | Victorias, derrotas y tablas |
| GET/DELETE | `/games/{id}` | Ver o borrar una partida |

Autenticación: cabecera `Authorization: Bearer <token>`.

## Migraciones (Alembic)

El esquema lo definen las migraciones de `migrations/`. En producción usa
`SHOGI_AUTO_CREATE=0` y aplica las migraciones (el contenedor Docker lo hace
al arrancar):

```bash
alembic upgrade head
alembic revision --autogenerate -m "describe el cambio"   # tras editar app/models.py
./scripts/generate_schema.sh                               # regenera database/schema.sql
```

## Tests

```bash
python -m pytest
# Contra PostgreSQL usando el esquema de database/schema.sql:
DATABASE_URL=postgresql://shogi:shogi@localhost/shogi_test alembic upgrade head
TEST_DATABASE_URL=postgresql://shogi:shogi@localhost/shogi_test TEST_KEEP_SCHEMA=1 SHOGI_AUTO_CREATE=0 python -m pytest
```
