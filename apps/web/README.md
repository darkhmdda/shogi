# Shōgi — aplicación web

Aplicación en React + TypeScript + Vite para aprender y jugar shōgi.

## Comandos

```bash
npm install       # instalar dependencias
npm run dev       # servidor de desarrollo
npm test          # tests del motor (Vitest)
npm run lint      # análisis estático (oxlint)
npm run build     # compilación de producción en dist/
```

## Estructura

```
src/
├── engine/              Motor de reglas puro (sin React), con tests
│   ├── types.ts         Tipos: piezas, tablero, posición, movimientos
│   ├── rules.ts         Movimientos, jaque, promoción, colocaciones, nifu, uchifuzume
│   ├── game.ts          Partida: historial, deshacer, mate, sennichite, jaque perpetuo
│   ├── explain.ts       Explicaciones educativas de jugadas legales e ilegales
│   ├── notation.ts      Notación kifu (▲7六歩) y USI (7g7f)
│   ├── pieces.ts        Nombres, kanji y descripciones de las piezas
│   ├── positions.ts     Posiciones de práctica y tsume
│   ├── ai.ts            Oponente: búsqueda negamax con poda alfa-beta, 3 niveles
│   ├── ai.worker.ts     Ejecuta la IA en un Web Worker
│   └── rules.test.ts    Tests, incluido perft hasta profundidad 3
├── hooks/useAiPlayer.ts Comunicación con el worker de la IA
├── components/
│   ├── ShogiBoard.tsx   Tablero interactivo, manos, panel y controles
│   └── PieceGuide.tsx   Guía de piezas con diagramas de movimiento
└── App.tsx              Página principal
```

## Coordenadas

El tablero se guarda como una matriz `board[row][col]`:

- `row 0` es la fila 一 (lado de Gote) y `row 8` la fila 九 (lado de Sente).
- `col 0` es la columna 9 y `col 8` la columna 1.

Así, la casilla 7六 es `{ row: 5, col: 2 }`.
