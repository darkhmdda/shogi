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
                │      backend         │  FastAPI + SQLAlchemy + WebSocket
                │                      │  Reglas en Python (shogi.py)
                └──────────┬───────────┘
                           │
                ┌──────────┴───────────┐
                │     PostgreSQL       │  users, auth_tokens, progress,
                │                      │  games, online_games
                └──────────────────────┘
```

## Principios

- **Un solo motor en el cliente.** Todas las reglas viven en `packages/engine`;
  la web y el móvil nunca reimplementan lógica de juego.
- **El servidor es la autoridad en línea.** Para las partidas entre usuarios,
  `backend/app/shogi.py` (port de las reglas a Python, verificado con el mismo
  perft) valida cada jugada, el turno y el resultado. Las partidas guardadas
  contra la máquina solo se validan en formato: son del propio usuario.
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

## Partidas en línea

1. Un jugador crea la partida (`POST /online`) y recibe un código de 6 letras.
2. El rival se une con el código (`POST /online/{code}/join`).
3. Cada jugada se envía con el número de jugadas que el cliente conoce
   (`ply`); si no coincide, el servidor responde 409 y el cliente se
   actualiza. Así no hay jugadas duplicadas ni desfasadas.
4. El servidor reproduce la partida con sus propias reglas, rechaza jugadas
   ilegales (422) y detecta mate, sennichite y jaque perpetuo.
5. Los cambios se envían por WebSocket (`/online/{code}/ws?token=…`) a todos
   los conectados; si el WebSocket falla, el cliente consulta cada 3 s.

Limitación actual: las conexiones WebSocket viven en memoria, así que la API
debe ejecutarse en un solo proceso (o añadir Redis pub/sub para escalar).
