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
- CI en `.github/workflows/ci.yml`: motor, web, móvil y backend con PostgreSQL.

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

## Pendiente (siguientes pasos sugeridos)
1. Cuentas y sincronización en la app móvil (reutilizar la API de `apps/web/src/api.ts`).
2. Migraciones con Alembic cuando cambie el esquema.
3. Más contenido: tsume de 5 jugadas, lecciones de aperturas y castillos.
4. Partidas en línea entre usuarios (WebSockets).
5. Tests de interfaz con Playwright en CI.
6. Despliegue (web estática + API + PostgreSQL gestionado).

## Comandos
```bash
npm install && npm test && npm run build      # motor y web
cd backend && pip install -e ".[dev]" && python -m pytest
docker compose up                             # PostgreSQL + API
```
