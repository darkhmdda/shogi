# Despliegue

## Con Docker Compose (todo en una máquina)

```bash
docker compose up --build
```

| Servicio | URL | Contenido |
|---|---|---|
| `web` | http://localhost:8080 | Web estática (nginx) |
| `api` | http://localhost:8000 | API; documentación en `/docs` |
| `db` | localhost:5432 | PostgreSQL 16 |

Al arrancar, el contenedor de la API ejecuta `alembic upgrade head`, así que
las actualizaciones del esquema se aplican solas.

> Cambia las contraseñas de `docker-compose.yml` antes de usarlo fuera de tu
> ordenador.

## Por piezas (producción)

1. **Base de datos:** cualquier PostgreSQL gestionado (16 o superior).
2. **API:** construye `backend/Dockerfile` y define:

   | Variable | Ejemplo |
   |---|---|
   | `DATABASE_URL` | `postgresql://usuario:clave@host:5432/shogi` |
   | `SHOGI_CORS_ORIGINS` | `https://shogi.ejemplo.com` |
   | `SHOGI_AUTO_CREATE` | `0` (el esquema lo gestiona Alembic) |
   | `SHOGI_TOKEN_DAYS` | `30` |

3. **Web:** es estática; sirve `apps/web/dist` en cualquier CDN o con
   `deploy/web.Dockerfile`:

   ```bash
   docker build -f deploy/web.Dockerfile --build-arg VITE_API_URL=https://api.shogi.ejemplo.com -t shogi-web .
   ```

   La API debe servirse por HTTPS si la web también lo hace.

4. **App móvil:** define `EXPO_PUBLIC_API_URL` y genera los binarios con
   [EAS Build](https://docs.expo.dev/build/introduction/).

## Migraciones

```bash
cd backend
alembic revision --autogenerate -m "describe el cambio"   # tras editar app/models.py
alembic upgrade head
./scripts/generate_schema.sh                               # actualiza database/schema.sql
```
