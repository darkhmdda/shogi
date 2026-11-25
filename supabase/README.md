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
3. **Web:** variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_KEY` (clave
   *publishable*). El workflow de GitHub Pages ya las incluye.

## Seguridad

Todas las tablas tienen Row Level Security: cada usuario solo puede leer y
escribir lo suyo. Los nombres de usuario son visibles para otros usuarios
registrados (hacen falta para el juego en línea). El progreso solo se modifica
a través de `merge_progress`, que nunca borra avances. La clave secreta
(`service_role` / `sb_secret_…`) no se usa en la app y no debe publicarse.
