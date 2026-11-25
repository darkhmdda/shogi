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

**Base de datos** (`database`): esquema PostgreSQL.

**Motor** (`packages/engine`): reglas, IA, solucionador de tsume, SFEN/KIF y
contenido educativo en TypeScript puro, compartido por la web y la futura app móvil.

## Tecnologías

- **Web:** React 19, TypeScript y Vite.
- **Motor:** TypeScript puro, con tests en Vitest.
- **Móvil:** React Native y Expo (prevista).
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
| `apps/mobile/` | ⏳ | Aplicación móvil (React Native + Expo) |
| `docs/` | ⏳ | Documentación técnica |

## Desarrollo

```bash
npm install          # instala la web y el motor (npm workspaces)
npm run dev          # web en http://localhost:5173
npm test             # tests del motor
npm run lint && npm run build
```

Backend y base de datos:

```bash
docker compose up    # PostgreSQL + API en http://localhost:8000
```

Para conectar la web con la API, crea `apps/web/.env` con
`VITE_API_URL=http://localhost:8000` (ver `apps/web/.env.example`). Sin esa
variable la web funciona igual, sin cuentas.

GitHub Actions comprueba el motor, la web y el backend (contra PostgreSQL)
en cada push.

## Estado del proyecto

En desarrollo. La aplicación web está completa; el backend y la base de
datos están operativos. Falta la aplicación móvil.

## Licencia

Pendiente de definir.
