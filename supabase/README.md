# Supabase

Backend alternativo a la API FastAPI, pensado para publicar gratis junto a
GitHub Pages: cuentas (con correo), progreso sincronizado y partidas guardadas.

## Puesta en marcha

1. **Base de datos:** en el panel de Supabase, *SQL Editor → New query*, pega
   el contenido de `migrations/20261125000001_cuentas_progreso_partidas.sql`
   y pulsa *Run*. Se puede ejecutar más de una vez sin problemas.
2. **Direcciones:** *Authentication → URL Configuration*:
   - *Site URL*: `https://darkhmdda.github.io/shogi/`
   - *Redirect URLs*: `https://darkhmdda.github.io/shogi/**` y, para
     desarrollo, `http://localhost:5173/**`
3. **Partidas en línea:**
   - Ejecuta también `migrations/20261125000002_partidas_en_linea.sql` en el
     SQL Editor.
   - Crea la Edge Function: *Edge Functions → Deploy a new function → Via
     Editor*, nombre **`online-move`**, sustituye todo el código por el
     contenido de [`functions/online-move/index.ts`](functions/online-move/index.ts)
     y pulsa *Deploy function*. (Con la CLI: `supabase functions deploy online-move`.)
4. **Web:** variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_KEY` (clave
   *publishable*). El workflow de GitHub Pages ya las incluye.

## La Edge Function `online-move`

Valida cada jugada en línea con el mismo motor de reglas que la app (incluye
uchifuzume, sennichite, jaque perpetuo…) antes de guardarla; los jugadores
reciben los cambios al instante por Realtime. Nadie puede escribir jugadas
directamente en la tabla.

- Código fuente: `functions/online-move/main.ts` y `handler.ts` (con tests).
- `functions/online-move/index.ts` es un **archivo generado** (incluye el
  motor): `npm run build:function`. La CI comprueba que esté al día.

## Seguridad

Todas las tablas tienen Row Level Security: cada usuario solo puede leer y
escribir lo suyo. Los nombres de usuario son visibles para otros usuarios
registrados (hacen falta para el juego en línea). El progreso solo se modifica
a través de `merge_progress`, que nunca borra avances. La clave secreta
(`service_role` / `sb_secret_…`) no se usa en la app y no debe publicarse.

## Evitar la pausa por inactividad

El plan gratuito pausa el proyecto tras una semana sin actividad. El workflow
[`supabase-keepalive.yml`](../.github/workflows/supabase-keepalive.yml) hace
una consulta pequeña cada tres días (y se puede lanzar a mano desde *Actions*).

Aviso: GitHub desactiva los workflows programados de un repositorio que pasa
60 días sin ningún commit. Te avisa por correo antes; basta con volver a
activarlo en *Actions* o hacer cualquier commit.
