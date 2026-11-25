/**
 * Servidor de la app móvil. Por defecto usa el mismo proyecto de Supabase que
 * la web publicada (la clave es la pública "publishable", pensada para ir en
 * la app). Se puede cambiar con variables de entorno de Expo:
 * EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_KEY, o usar la API propia
 * con EXPO_PUBLIC_API_URL (y EXPO_PUBLIC_SUPABASE_URL vacía).
 */
const env = process.env

export const SUPABASE_URL: string | null =
  env.EXPO_PUBLIC_SUPABASE_URL !== undefined
    ? env.EXPO_PUBLIC_SUPABASE_URL.trim() || null
    : 'https://jmojorddnjgxqjnpkvcs.supabase.co'

export const SUPABASE_KEY: string | null =
  env.EXPO_PUBLIC_SUPABASE_KEY?.trim() || (SUPABASE_URL ? 'sb_publishable_O5sUEAooXq6wNq9Powzbmg_JzWdMHNY' : null)

export const API_URL: string | null = SUPABASE_URL ? null : env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') || null

/** Página web a la que llevan los enlaces de los correos (confirmar cuenta, recuperar contraseña). */
export const WEB_URL = env.EXPO_PUBLIC_WEB_URL?.trim() || 'https://darkhmdda.github.io/shogi/'
