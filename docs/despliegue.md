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

## En Render (gratis para empezar)

El archivo [`render.yaml`](../render.yaml) describe la base de datos, la API y
la web. En el panel de Render: **New → Blueprint**, elige este repositorio y
aplica. Después:

1. Copia la URL real de la web y de la API que te asigne Render.
2. Actualiza `SHOGI_CORS_ORIGINS` (API) y `VITE_API_URL` (web) con ellas y
   vuelve a desplegar la web.
3. Para la app móvil, usa la URL de la API en `EXPO_PUBLIC_API_URL`.

> No se ha podido probar el despliegue real desde el entorno de desarrollo:
> revisa los planes, la región y los nombres en el panel antes de aplicarlo.

## Por piezas (producción)

1. **Base de datos:** cualquier PostgreSQL gestionado (16 o superior).
2. **API:** construye `backend/Dockerfile` y define:

   | Variable | Ejemplo |
   |---|---|
   | `DATABASE_URL` | `postgresql://usuario:clave@host:5432/shogi` (también vale `postgres://`) |
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

## Web instalable (PWA)

La web incluye manifiesto e iconos y un *service worker* (`apps/web/public/sw.js`):
en el móvil se puede "Añadir a la pantalla de inicio" y funciona sin conexión
(lecciones, problemas y partidas contra la máquina). Al cambiar la estrategia
de caché, incrementa `CACHE` en `sw.js`.

## Seguridad

- Contraseñas con scrypt; los tokens de sesión se guardan como hash SHA-256.
- Máximo 5 intentos fallidos de inicio de sesión por usuario e IP cada 5 minutos
  (en memoria: con varios procesos, usa un almacén compartido como Redis).
- Cambiar la contraseña cierra todas las sesiones; borrar la cuenta elimina
  progreso, partidas y sesiones.
- Sirve la API siempre por HTTPS en producción.
