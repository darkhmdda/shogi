# Base de datos

PostgreSQL 16. El esquema está en [`schema.sql`](schema.sql) y equivale a los
modelos de SQLAlchemy de `backend/app/models.py`.

| Tabla | Contenido |
|---|---|
| `users` | Cuentas (contraseñas con scrypt) |
| `auth_tokens` | Sesiones (solo el hash del token) |
| `progress` | Lecciones y problemas completados, contadores de partidas |
| `games` | Partidas guardadas: SFEN inicial + movimientos USI |

## Origen del esquema

`schema.sql` es un **archivo generado** a partir de las migraciones de Alembic
(`backend/migrations`). No lo edites a mano: cambia `backend/app/models.py`,
crea una migración y regenéralo con `backend/scripts/generate_schema.sh`. La
CI falla si no está al día.

## Crear la base de datos

Con Alembic (recomendado, deja la base de datos lista para futuras migraciones):

```bash
createuser shogi --pwprompt
createdb shogi --owner shogi
cd backend && DATABASE_URL=postgresql://shogi:CLAVE@localhost/shogi alembic upgrade head
```

O directamente con el SQL generado (equivalente, incluye la versión de Alembic):

```bash
psql postgresql://shogi:CLAVE@localhost/shogi -f database/schema.sql
```

Con Docker, `docker compose up` aplica las migraciones al arrancar la API.
