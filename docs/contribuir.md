# Cómo contribuir

## Preparar el entorno

```bash
npm install                                  # motor, web y móvil (npm workspaces)
cd backend && pip install -e ".[dev]"        # API
```

## Antes de subir cambios

```bash
npm run typecheck && npm test && npm run lint && npm run build
npm run e2e --workspace web                  # tests de interfaz
cd backend && python -m pytest
```

La CI de GitHub Actions ejecuta lo mismo, además de las migraciones contra
PostgreSQL y el empaquetado de la app móvil.

## Añadir contenido

- **Lección:** añade una entrada a `LESSONS` en `packages/engine/src/lessons.ts`.
  Cada paso es una posición SFEN y un objetivo (`move`, `capture`, `drop`,
  `promote`, `check`, `mate`, `any`). El test `content.test.ts` comprueba
  automáticamente que el paso se puede completar.
- **Problema de mate:** añade una entrada a `TSUME` en
  `packages/engine/src/tsume.ts` con la posición del atacante; el resto de
  piezas pasa a la mano del defensor. El test verifica que existe el mate en
  el número de jugadas indicado (y no antes, en los de 3).
- **Apertura:** añade una línea USI a `OPENING_LINES` en `ai.ts`; el test
  comprueba que todas las jugadas son legales.

## Convenciones

- Textos de la interfaz y comentarios en español.
- Toda la lógica de juego va en `packages/engine`, nunca en las apps.
- Commits con prefijo (`feat:`, `fix:`, `docs:`…).
