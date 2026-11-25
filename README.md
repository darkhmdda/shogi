# Shōgi

Aplicación multiplataforma para aprender y jugar shōgi, el ajedrez japonés.

## Objetivo

Crear una aplicación que permita a principiantes aprender las reglas del shōgi mediante lecciones interactivas, ejercicios y partidas.

## Funcionalidades

**Aplicación web** (`apps/web`)

- Partidas contra la máquina (tres niveles) o entre dos personas, con todas
  las reglas: promoción, colocaciones, nifu, uchifuzume, jaque mate,
  sennichite, jaque perpetuo e impasse (jishōgi, regla de 27 puntos).
- Nueve lecciones guiadas con objetivos que comprueba el motor.
- Quince problemas de mate (tsume) en 1 y en 3 jugadas, verificados por un
  solucionador propio.
- Guía de piezas, explicaciones de jugadas ilegales, pistas de la máquina.
- Registro kifu, exportación KIF, importación/exportación SFEN y guardado
  automático de la partida.
- Progreso local y, con cuenta, sincronizado con el servidor.

**Backend** (`backend`): API FastAPI con cuentas, sincronización del progreso
(fusión sin pérdida de datos entre dispositivos) y partidas guardadas.

**Base de datos** (`database`): PostgreSQL con migraciones de Alembic.

**Aplicación móvil** (`apps/mobile`): Expo para iOS y Android con lecciones,
problemas, partidas contra la máquina y cuenta opcional sincronizada con la web.

**Motor** (`packages/engine`): reglas, IA, solucionador de tsume, SFEN/KIF y
contenido educativo en TypeScript puro, compartido por la web y la app móvil.

## Tecnologías

- **Web:** React 19, TypeScript y Vite.
- **Motor:** TypeScript puro, con tests en Vitest.
- **Móvil:** React Native 0.88 y Expo SDK 58.
- **Backend:** Python, FastAPI y SQLAlchemy.
- **Base de datos:** PostgreSQL.
- **CI:** GitHub Actions.

## Estructura del proyecto

| Carpeta | Estado | Contenido |
|---|---|---|
| `apps/web/` | ✅ | Aplicación web (React + TypeScript + Vite) |
| `packages/engine/` | ✅ | Motor de reglas e IA compartido |
| `backend/` | ✅ | API (FastAPI + SQLAlchemy) |
| `database/` | ✅ | Esquema PostgreSQL |
| `apps/mobile/` | ✅ | Aplicación móvil (Expo + React Native) |
| `packages/react/` | ✅ | Hooks de React compartidos por web y móvil |
| `packages/api/` | ✅ | Cliente de la API compartido por web y móvil |
| `deploy/` | ✅ | Imagen de la web (nginx) |
| `docs/` | ✅ | [Arquitectura](docs/arquitectura.md), [despliegue](docs/despliegue.md), [cómo contribuir](docs/contribuir.md) |

## Desarrollo

```bash
npm install          # instala la web y el motor (npm workspaces)
npm run dev          # web en http://localhost:5173
npm test             # tests del motor
npm run lint && npm run build
npm run mobile       # app móvil con Expo
```

Backend y base de datos:

```bash
docker compose up --build   # PostgreSQL + API (:8000) + web (:8080)
```

Para conectar la web con la API, crea `apps/web/.env` con
`VITE_API_URL=http://localhost:8000` (ver `apps/web/.env.example`). Sin esa
variable la web funciona igual, sin cuentas.

GitHub Actions comprueba en cada push el motor, la web (también con tests de
interfaz en Playwright), la app móvil, las migraciones y el backend contra
PostgreSQL.

## Estado del proyecto

En desarrollo. Web completa; app móvil, backend y base de datos operativos y
sincronizados entre sí. Pendiente: partidas en línea entre usuarios, más
contenido y despliegue público.

## Licencia

Pendiente de definir.
