# Base de datos

PostgreSQL 16. El esquema está en [`schema.sql`](schema.sql) y equivale a los
modelos de SQLAlchemy de `backend/app/models.py`.

| Tabla | Contenido |
|---|---|
| `users` | Cuentas (contraseñas con scrypt) |
| `auth_tokens` | Sesiones (solo el hash del token) |
| `progress` | Lecciones y problemas completados, contadores de partidas |
| `games` | Partidas guardadas: SFEN inicial + movimientos USI |

## Crear la base de datos

```bash
createuser shogi --pwprompt
createdb shogi --owner shogi
psql postgresql://shogi:CONTRASEÑA@localhost/shogi -f database/schema.sql
```

Con Docker basta con `docker compose up` en la raíz del repositorio: el
contenedor de PostgreSQL aplica `schema.sql` al arrancar por primera vez.
