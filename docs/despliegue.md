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

## En GitHub Pages (web, gratis y siempre encendida)

El workflow [`.github/workflows/pages.yml`](../.github/workflows/pages.yml)
publica la web en `https://<usuario>.github.io/<repositorio>/` en cada push a
`main`. Funciona todo lo que no necesita servidor: lecciones, problemas,
partidas contra la máquina, progreso local y uso sin conexión.

Una sola vez: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
Después, cada push a `main` actualiza la web en un par de minutos (pestaña
*Actions*, workflow "Publicar web").

Para activar cuentas y juego en línea, define la variable de repositorio
`VITE_API_URL` (Settings → Secrets and variables → Actions → Variables) con la
URL del servidor y vuelve a ejecutar el workflow.

## En Render (gratis para empezar)

El archivo [`render.yaml`](../render.yaml) describe la base de datos, la API y
la web, y conecta cada servicio con la dirección real del otro.

1. Crea una cuenta en <https://render.com> (puedes entrar con GitHub).
2. **New → Blueprint** y elige el repositorio `shogi`. Si no aparece, pulsa
   *Configure account* y da acceso a Render al repositorio.
3. Render lee `render.yaml` y muestra `shogi-db`, `shogi-api` y `shogi-web`.
   Pulsa **Apply** (o *Deploy Blueprint*).
4. Espera a que los tres estén en verde (la API tarda unos minutos la primera
   vez porque construye la imagen Docker y aplica las migraciones).
5. Abre la URL de `shogi-web`. Comprueba la API en `https://<url-de-la-api>/health`.
6. Para la app móvil, usa la URL de la API en `EXPO_PUBLIC_API_URL`.

Limitaciones habituales del plan gratuito de Render (compruébalas en su web,
cambian con el tiempo): la API se duerme tras un rato sin uso y la primera
visita tarda en despertarla, y la base de datos gratuita caduca a las pocas
semanas salvo que pases a un plan de pago.

Si Render rechaza el Blueprint, copia el mensaje de error: suele bastar con
ajustar un campo de `render.yaml`.

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
