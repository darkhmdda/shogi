# Proyecto Shogi — Nota de continuidad

## Estado actual
- Monorepo con npm workspaces: `packages/engine` (motor) y `apps/web` (web).
- Motor propio con 68 tests (perft, reglas, lecciones, tsume, SFEN/KIF, IA).
- IA: búsqueda iterativa con tiempo límite, alfa-beta, quiescencia, tabla de
  transposición, libro de aperturas. Corre en un Web Worker.
- Web completa: partidas, lecciones, tsume, guía de piezas, impasse, SFEN/KIF,
  guardado automático, progreso y cuenta opcional (VITE_API_URL).
- Backend FastAPI en `backend/` (10 tests, probados también contra PostgreSQL).
- Esquema PostgreSQL en `database/schema.sql`; `docker compose up` levanta todo.
- App móvil Expo SDK 58 en `apps/mobile` (inicio, lecciones, problemas, jugar).
- `packages/react`: hook `useMoveInput` compartido por web y móvil.
- Una sola versión de React (19.3.0) forzada con `overrides` en la raíz.
- `packages/api`: cliente HTTP compartido; web y móvil tienen cuenta y sincronización.
- Migraciones con Alembic (`backend/migrations`); `database/schema.sql` se genera de ellas.
- Tests de interfaz con Playwright (`apps/web/e2e`, escritorio y móvil).
- Documentación en `docs/` (arquitectura, despliegue, contribuir).
- 12 lecciones y 20 tsume (mate en 1, 3 y 5).
- Seguridad: límite de intentos de login, cambio de contraseña, borrado de cuenta.
- PWA: manifiesto, iconos propios y service worker (funciona sin conexión).
- `render.yaml` para desplegar BD + API + web en Render (sin probar en real).
- `useOnlineGame` en `packages/react`, compartido por web y móvil.
- Partidas en línea (web y móvil, también entre sí): `backend/app/routers/online.py` + WebSocket; reglas en
  Python (`backend/app/shogi.py`, mismo perft que el motor TS).
- CI en `.github/workflows/ci.yml`: motor, web, e2e, móvil, migraciones y backend con PostgreSQL.

## Decisión sobre bibliotecas externas
Se descartaron @huguzturk/shogijs y shogiops:
- shogijs tenía limitaciones (colocaciones en `hasAnyLegalMove`, `load()`, sin SFEN).
- shogiops es GPL-3.0-or-later y obligaría a licenciar toda la app como GPL.
- El modo educativo necesita explicar por qué una jugada es ilegal
  (`engine/explain.ts`), algo que ninguna biblioteca ofrece.

## Reglas implementadas
Movimientos de todas las piezas (promocionadas o no), capturas y mano,
colocaciones, promoción opcional y obligatoria, nifu, piezas sin movimiento,
uchifuzume, jaque, jaque mate, derrota sin jugadas legales, sennichite
(tablas) y jaque perpetuo (pierde quien da jaque).

## Pendiente (requiere decisiones o cuentas del responsable)
1. Elegir licencia (README: "Pendiente de definir").
2. Desplegar con `render.yaml` o `docker compose` en un servidor propio.
   Las imágenes Docker no se pudieron construir en el entorno de desarrollo
   (Docker Hub 429 y sin PyPI dentro de los contenedores).
3. Probar la app móvil en iOS/Android reales y publicarla con EAS.
4. Opcional: cambiar contraseña / borrar cuenta también desde la app móvil,
   más tsume, IA más fuerte, modo oscuro.

## Comandos
```bash
npm install && npm test && npm run build      # motor y web
cd backend && pip install -e ".[dev]" && python -m pytest
docker compose up                             # PostgreSQL + API
```
