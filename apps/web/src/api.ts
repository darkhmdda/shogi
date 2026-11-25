/**
 * Conexión con el servidor. Admite dos backends:
 * - Supabase (VITE_SUPABASE_URL + VITE_SUPABASE_KEY): cuentas con correo, progreso y partidas.
 * - API propia FastAPI (VITE_API_URL): cuentas con usuario, progreso, partidas y juego en línea.
 * Sin ninguno, la app funciona igual pero sin cuentas.
 */
import { createApiClient, pickProgress, progressFingerprint, type GameUpload, type SavedGame } from '@shogi/api'
import type { SupabaseBackend } from '@shogi/api/supabase'
import { useSyncExternalStore } from 'react'
import { getProgress, replaceProgress, subscribe as subscribeProgress } from './progress'

export { ApiError, type OnlineState, type SavedGame } from '@shogi/api'

/** Acepta una URL completa o solo el host (como lo entrega Render), que se sirve por HTTPS. */
function normalizeUrl(raw: string | undefined): string | null {
  const value = raw?.trim().replace(/\/$/, '')
  if (!value) return null
  return /^https?:\/\//.test(value) ? value : `https://${value}`
}

const SUPABASE_URL = normalizeUrl(import.meta.env.VITE_SUPABASE_URL as string | undefined)
const SUPABASE_KEY = (import.meta.env.VITE_SUPABASE_KEY as string | undefined)?.trim() || null

/** URL de la API FastAPI (solo si no se usa Supabase). */
export const API_URL: string | null = SUPABASE_URL ? null : normalizeUrl(import.meta.env.VITE_API_URL as string | undefined)

export type Backend = 'supabase' | 'fastapi' | null
export const BACKEND: Backend = SUPABASE_URL && SUPABASE_KEY ? 'supabase' : API_URL ? 'fastapi' : null

/** ¿Hay cuentas de usuario? */
export const ACCOUNTS_AVAILABLE = BACKEND !== null
/** ¿Se entra con correo (Supabase) en lugar de con nombre de usuario? */
export const LOGIN_WITH_EMAIL = BACKEND === 'supabase'
/** ¿Hay juego en línea? (de momento, solo con la API FastAPI). */
export const ONLINE_AVAILABLE = BACKEND === 'fastapi'

export type Account = { username: string; email?: string; token?: string }

// La librería de Supabase solo se descarga si se usa (no pesa en la web sin servidor).
let supabase: SupabaseBackend | null = null
const supabaseReady: Promise<SupabaseBackend | null> =
  BACKEND === 'supabase' && typeof window !== 'undefined'
    ? import('@shogi/api/supabase').then(({ createSupabaseBackend }) => {
        supabase = createSupabaseBackend({
          url: SUPABASE_URL!,
          key: SUPABASE_KEY!,
          // El enlace de confirmación del correo vuelve a esta misma web.
          redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}#cuenta`,
        })
        return supabase
      })
    : Promise.resolve(null)

// ---------------------------------------------------------------------------
// Estado de la sesión
// ---------------------------------------------------------------------------

const KEY = 'shogi.account.v1'

function loadStoredAccount(): Account | null {
  if (BACKEND !== 'fastapi') return null
  try {
    const raw = window.localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Account) : null
  } catch {
    return null
  }
}

let account: Account | null = typeof window === 'undefined' ? null : loadStoredAccount()
const listeners = new Set<() => void>()

function setAccount(next: Account | null) {
  const wasLoggedOut = account === null
  account = next
  if (BACKEND === 'fastapi') {
    try {
      if (next) window.localStorage.setItem(KEY, JSON.stringify(next))
      else window.localStorage.removeItem(KEY)
    } catch {
      // Sin almacenamiento: la sesión dura hasta recargar.
    }
  }
  listeners.forEach((listener) => listener())
  // Al iniciar sesión (también al volver del enlace de confirmación), se sincroniza.
  if (wasLoggedOut && next) syncProgress().catch(() => {})
}

const client =
  BACKEND === 'fastapi'
    ? createApiClient({ baseUrl: API_URL!, getToken: () => account?.token ?? null, onUnauthorized: () => setAccount(null) })
    : null

supabaseReady.then((backend) => {
  if (!backend) return
  backend.currentAccount().then((current) => current && setAccount(current))
  backend.onAuthChange((next) => {
    if (next?.username !== account?.username) setAccount(next)
  })
})

/** Cliente de la API FastAPI (para el juego en línea); null con Supabase o sin servidor. */
export function getClient() {
  return client
}

export function useAccount(): Account | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => account,
    () => account,
  )
}

// ---------------------------------------------------------------------------
// Acciones de la cuenta
// ---------------------------------------------------------------------------

export type Credentials = { username: string; email: string; password: string }

/**
 * Inicia sesión o crea la cuenta. Con Supabase, si el proyecto exige confirmar
 * el correo, devuelve needsConfirmation y la sesión empieza al pulsar el enlace.
 */
export async function authenticate(
  mode: 'login' | 'register',
  { username, email, password }: Credentials,
): Promise<{ needsConfirmation: boolean }> {
  await supabaseReady
  if (supabase) {
    if (mode === 'login') {
      setAccount(await supabase.signIn(email, password))
      return { needsConfirmation: false }
    }
    const result = await supabase.signUp(email, password, username)
    if (result.account) setAccount(result.account)
    return { needsConfirmation: result.needsConfirmation }
  }
  if (client) {
    setAccount(await client[mode](username, password))
  }
  return { needsConfirmation: false }
}

export async function changePassword(current: string, next: string) {
  await supabaseReady
  if (supabase && account?.email) {
    await supabase.changePassword(account.email, current, next)
  } else if (client) {
    setAccount(await client.changePassword(current, next))
  }
}

/** Borra la cuenta en el servidor. El progreso local del navegador se conserva. */
export async function deleteAccount(password: string) {
  await supabaseReady
  if (supabase && account?.email) await supabase.deleteAccount(account.email, password)
  else if (client) await client.deleteAccount(password)
  setAccount(null)
}

export async function logout() {
  try {
    await supabaseReady
    if (supabase) await supabase.signOut()
    else await client?.logout()
  } finally {
    setAccount(null)
  }
}

// ---------------------------------------------------------------------------
// Progreso y partidas
// ---------------------------------------------------------------------------

let lastSynced = ''

/** Envía el progreso local y adopta el resultado fusionado del servidor. */
export async function syncProgress(): Promise<void> {
  if (!account) return
  await supabaseReady
  const local = getProgress()
  const merged = supabase
    ? await supabase.mergeProgress(local)
    : client
      ? pickProgress(await client.mergeProgress(local))
      : null
  if (!merged) return
  lastSynced = progressFingerprint(merged)
  replaceProgress(merged)
}

// Sincronización automática (con un pequeño retardo) cuando cambia el progreso.
let timer: number | undefined
if (typeof window !== 'undefined' && ACCOUNTS_AVAILABLE) {
  subscribeProgress(() => {
    if (!account || progressFingerprint(getProgress()) === lastSynced) return
    window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      syncProgress().catch(() => {
        // Sin conexión: se volverá a intentar en el próximo cambio.
      })
    }, 1500)
  })
}

let gamesVersion = 0
const gamesListeners = new Set<() => void>()

/** Cambia cada vez que se guarda una partida, para refrescar las listas. */
export function useGamesVersion(): number {
  return useSyncExternalStore(
    (listener) => {
      gamesListeners.add(listener)
      return () => gamesListeners.delete(listener)
    },
    () => gamesVersion,
    () => gamesVersion,
  )
}

export async function uploadGame(game: GameUpload): Promise<void> {
  if (!account) return
  await supabaseReady
  if (supabase) await supabase.saveGame(game)
  else if (client) await client.saveGame(game)
  else return
  gamesVersion++
  gamesListeners.forEach((listener) => listener())
}

export async function listGames(): Promise<SavedGame[]> {
  await supabaseReady
  if (supabase) return supabase.listGames(10)
  return client ? client.listGames(10) : []
}
