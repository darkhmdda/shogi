# @shogi/engine

Motor de reglas de shōgi en TypeScript puro, sin dependencias. Lo usan la
aplicación web (`apps/web`) y la aplicación móvil (`apps/mobile`).

| Módulo | Contenido |
|---|---|
| `rules.ts` | Movimientos, jaque, promoción, colocaciones, nifu, uchifuzume, impasse |
| `game.ts` | Partida: historial, deshacer, mate, sennichite, jaque perpetuo |
| `ai.ts` | IA: búsqueda iterativa, alfa-beta, quiescencia, libro de aperturas |
| `mate.ts` | Solucionador de tsume |
| `record.ts` | SFEN y KIF |
| `notation.ts` | Notación kifu (▲7六歩) y USI (7g7f) |
| `explain.ts` | Explicaciones educativas |
| `lessons.ts`, `tsume.ts`, `positions.ts` | Contenido de aprendizaje |

```bash
npm test --workspace @shogi/engine
```
