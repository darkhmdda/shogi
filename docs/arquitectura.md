# Arquitectura

```
                ┌──────────────────────┐
                │   packages/engine    │  Reglas, IA, tsume, SFEN/KIF,
                │   (@shogi/engine)    │  lecciones. TypeScript puro.
                └──────────┬───────────┘
                           │
                ┌──────────┴───────────┐
                │   packages/react     │  useMoveInput: selección,
                │   (@shogi/react)     │  colocaciones y promoción.
                └──────┬────────┬──────┘
                       │        │
        ┌──────────────┴─┐    ┌─┴──────────────┐
        │   apps/web     │    │  apps/mobile   │
        │ React + Vite   │    │ Expo + RN      │
        └───────┬────────┘    └────────┬───────┘
                │   packages/api       │   Cliente HTTP compartido
                └──────────┬───────────┘   (@shogi/api)
                           │ HTTPS + Bearer token
                ┌──────────┴───────────┐
                │      backend         │  FastAPI + SQLAlchemy
                │                      │  Migraciones con Alembic
                └──────────┬───────────┘
                           │
                ┌──────────┴───────────┐
                │     PostgreSQL       │  users, auth_tokens,
                │                      │  progress, games
                └──────────────────────┘
```

## Principios

- **Un solo motor.** Todas las reglas viven en `packages/engine`; la web y el
  móvil nunca reimplementan lógica de juego. El backend no valida la legalidad
  de las partidas (solo su formato): las partidas guardadas son del propio
  usuario y no hay partidas en línea todavía.
- **Sin conexión primero.** El progreso y la partida en curso se guardan en el
  dispositivo. La cuenta es opcional; al iniciar sesión, el servidor *fusiona*
  el progreso (unión de lecciones y problemas, máximo de contadores), así que
  nunca se pierde nada al usar varios dispositivos.
- **Contenido verificado.** Cada lección y cada tsume tienen un test que
  comprueba con el motor que se pueden resolver.

## Motor

| Módulo | Responsabilidad |
|---|---|
| `rules.ts` | Generación de jugadas legales, ataques, jaque, promoción, colocaciones (nifu, uchifuzume), impasse |
| `game.ts` | Historial, deshacer, resultado (mate, sin jugadas, sennichite, jaque perpetuo, abandono, impasse) |
| `ai.ts` | Negamax con alfa-beta, profundización iterativa con límite de tiempo, quiescencia, tabla de transposición, jugadas asesinas, extensión de jaque, libro de aperturas |
| `mate.ts` | Solucionador de tsume y respuesta del defensor |
| `record.ts` | SFEN, KIF, guardar/recuperar partidas |
| `explain.ts` | Explicaciones en español de jugadas legales e ilegales |

Coordenadas: `board[row][col]`, con `row 0` = fila 一 (lado de Gote) y
`col 0` = columna 9. La casilla 7六 es `{ row: 5, col: 2 }`.

La generación de jugadas está validada con *perft* (30 / 900 / 25 470 desde
la posición inicial).

## Datos

El esquema lo definen las migraciones de `backend/migrations` (Alembic).
`database/schema.sql` se genera a partir de ellas y la CI comprueba que esté
al día.

## Calidad

| Comprobación | Dónde |
|---|---|
| Tests del motor y del cliente API (Vitest) | `npm test` |
| Tests del backend (pytest, SQLite y PostgreSQL) | `backend/` |
| Tests de interfaz (Playwright, escritorio y móvil) | `apps/web/e2e` |
| Tipos de todos los paquetes y la app móvil | `npm run typecheck` |
| Migraciones de ida y vuelta, modelos sincronizados | CI |
