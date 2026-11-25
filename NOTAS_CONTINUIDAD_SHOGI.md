# Proyecto Shogi — Nota de continuidad

## Estado actual
- Proyecto React + TypeScript + Vite en `apps/web`.
- Motor de reglas propio en `apps/web/src/engine/`, sin dependencias externas
  y con tests en Vitest (`npm test`). Incluye perft hasta profundidad 3
  (30 / 900 / 25 470), que coincide con los valores de referencia.
- La interfaz (`components/ShogiBoard.tsx`) solo usa el motor; no contiene reglas.
- IA propia (negamax + alfa-beta) en un Web Worker, con niveles fácil, normal y difícil.
- CI en `.github/workflows/web.yml`: lint, tests y build.

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
1. Jishōgi / impasse (declaración por puntos, regla de 24/27 puntos).
2. Importar/exportar SFEN y KIF para guardar y compartir partidas.
3. Guardar la partida en curso (localStorage) y el progreso del usuario.
4. Lecciones guiadas paso a paso usando `engine/positions.ts` y `engine/explain.ts`.
5. Más tsume (mate en 1, 3 y 5) y un modo de problemas con puntuación.
6. Mejorar la IA: quiescencia, tabla de transposición y evaluación de seguridad del rey.
7. Mover `engine/` a `packages/engine` cuando empiece la app móvil (React Native).
8. Tests de interfaz (Playwright) para los flujos principales.

## Comandos
```bash
cd apps/web
npm install
npm test
npm run build
```
