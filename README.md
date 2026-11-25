# Shōgi

Aplicación multiplataforma para aprender y jugar shōgi, el ajedrez japonés.

## Objetivo

Crear una aplicación que permita a principiantes aprender las reglas del shōgi mediante lecciones interactivas, ejercicios y partidas.

## Funcionalidades

Ya disponibles en la aplicación web:

- Tablero de 9 × 9 con coordenadas, piezas en mano y orientación según el bando.
- Motor de reglas completo y probado: movimientos, capturas, colocaciones,
  promoción opcional y obligatoria, nifu, uchifuzume, jaque, jaque mate,
  sennichite y jaque perpetuo.
- Ayudas educativas: jugadas posibles resaltadas y explicación de por qué un
  movimiento no es legal.
- Guía de piezas con diagramas de movimiento.
- Posiciones de práctica y problemas de mate en una (tsume).
- Partidas contra la máquina (tres niveles) o entre dos personas.
- Deshacer, rendirse y registro de la partida en notación japonesa (kifu).

Previstas:

- Lecciones guiadas paso a paso y más ejercicios.
- Seguimiento del progreso del usuario.
- Aplicación móvil, backend y base de datos.

## Tecnologías previstas

- **Aplicación web:** React y TypeScript.
- **Aplicación móvil:** React Native y Expo.
- **Backend:** Python y FastAPI.
- **Base de datos:** PostgreSQL.
- **Control de versiones:** Git y GitHub.

## Estructura del proyecto

Actual:

- `apps/web/`: aplicación web, que incluye el motor de reglas en
  `apps/web/src/engine/`. Más detalles en [apps/web/README.md](apps/web/README.md).

Prevista:

- `apps/mobile/`: aplicación móvil.
- `backend/`: API y servicios del servidor.
- `packages/`: código compartido (el motor se moverá aquí cuando exista la app móvil).
- `database/`: scripts y estructura de la base de datos.
- `docs/`: documentación técnica.

## Desarrollo

```bash
cd apps/web
npm install
npm run dev
```

Antes de subir cambios: `npm run lint && npm test && npm run build`.
GitHub Actions ejecuta estas mismas comprobaciones en cada push.

## Estado del proyecto

En desarrollo. La aplicación web ya permite aprender las piezas, practicar
posiciones y jugar partidas completas con todas las reglas oficiales
(salvo la declaración de impasse, jishōgi).

## Licencia

Pendiente de definir.
