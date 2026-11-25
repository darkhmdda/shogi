/**
 * Cuenta de usuario en el móvil. Igual que la web: Supabase (por defecto) o la
 * API propia FastAPI. Sin servidor, la app funciona sin cuentas.
 */
import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  createApiClient,
  pickProgress,
  progressFingerprint,
  type GameUpload,
  type OnlineProvider,
  type SavedGame,
} from '@shogi/api'
import { createSupabaseBackend } from '@shogi/api/supabase'
import { useSyncExternalStore } from 'react'
import { AppState } from 'react-native'
import { API_URL, SUPABASE_KEY, SUPABASE_URL, WEB_URL } from './config'
import { getProgress, replaceProgress, subscribe as subscribeProgress } from './progress'

export type Account = { username: string; email?: string; token?: string }

/** ¿Hay cuentas? ¿Se entra con correo (Supabase)? */
export const ACCOUNTS_AVAILABLE = Boolean((SUPABASE_URL && SUPABASE_KEY) || API_URL)
export const LOGIN_WITH_EMAIL = Boolean(SUPABASE_URL && SUPABASE_KEY)

const KEY = 'shogi.account.v1'

let account: Account | null = null
let gamesVersion = 0
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => listener())
}

function setAccount(next: Account | null) {
  const wasLoggedOut = account === null
  account = next
  emit()
  if (client) {
    const write = next ? AsyncStorage.setItem(KEY, JSON.stringify(next)) : AsyncStorage.removeItem(KEY)
    write.catch(() => {})
  }
  if (wasLoggedOut && next) syncProgress().catch(() => {})
}

const supabase =
  SUPABASE_URL && SUPABASE_KEY
    ? createSupabaseBackend({ url: SUPABASE_URL, key: SUPABASE_KEY, storage: AsyncStorage, redirectTo: WEB_URL })
    : null

const client =
  !supabase && API_URL
    ? createApiClient({ baseUrl: API_URL, getToken: () => account?.token ?? null, onUnauthorized: () => setAccount(null) })
    : null

if (supabase) {
  supabase.onAuthChange((next) => {
    if (next?.username !== account?.username) setAccount(next)
  })
  // En React Native la sesión solo se renueva con la app en primer plano.
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.supabase.auth.startAutoRefresh()
    else supabase.supabase.auth.stopAutoRefresh()
  })
}

/** Juego en línea del servidor configurado (null sin servidor). */
export function getOnlineProvider(): OnlineProvider | null {
  return supabase?.online ?? client?.online ?? null
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useAccount(): Account | null {
  return useSyncExternalStore(subscribe, () => account)
}

export function useGamesVersion(): number {
  return useSyncExternalStore(subscribe, () => gamesVersion)
}

/** Recupera la sesión guardada y sincroniza. Se llama al arrancar. */
export async function loadAccount(): Promise<void> {
  try {
    if (supabase) {
      const current = await supabase.currentAccount()
      if (current) setAccount(current)
      return
    }
    if (client) {
      const raw = await AsyncStorage.getItem(KEY)
      if (raw) setAccount(JSON.parse(raw) as Account)
    }
  } catch {
    // Sin conexión o datos corruptos: se sigue sin sesión.
  }
}

export type Credentials = { username: string; email: string; password: string }

export async function authenticate(
  mode: 'login' | 'register',
  { username, email, password }: Credentials,
): Promise<{ needsConfirmation: boolean }> {
  if (supabase) {
    if (mode === 'login') {
      setAccount(await supabase.signIn(email, password))
      return { needsConfirmation: false }
    }
    const result = await supabase.signUp(email, password, username)
    if (result.account) setAccount(result.account)
    return { needsConfirmation: result.needsConfirmation }
  }
  if (client) setAccount(await client[mode](username, password))
  return { needsConfirmation: false }
}

export async function logout() {
  try {
    if (supabase) await supabase.signOut()
    else await client?.logout()
  } finally {
    setAccount(null)
  }
}

export async function changePassword(current: string, next: string) {
  if (supabase && account?.email) await supabase.changePassword(account.email, current, next)
  else if (client) setAccount(await client.changePassword(current, next))
}

/** Borra la cuenta en el servidor. El progreso guardado en el teléfono se conserva. */
export async function deleteAccount(password: string) {
  if (supabase && account?.email) await supabase.deleteAccount(account.email, password)
  else if (client) await client.deleteAccount(password)
  setAccount(null)
}

export async function requestPasswordReset(email: string) {
  if (!supabase) throw new Error('Esta opción solo está disponible con Supabase.')
  await supabase.requestPasswordReset(email)
}

export async function resendConfirmation(email: string) {
  if (!supabase) throw new Error('Esta opción solo está disponible con Supabase.')
  await supabase.resendConfirmation(email)
}

let lastSynced = ''

export async function syncProgress(): Promise<void> {
  if (!account) return
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

let timer: ReturnType<typeof setTimeout> | undefined
if (ACCOUNTS_AVAILABLE) {
  subscribeProgress(() => {
    if (!account || progressFingerprint(getProgress()) === lastSynced) return
    clearTimeout(timer)
    timer = setTimeout(() => {
      syncProgress().catch(() => {})
    }, 1500)
  })
}

export async function uploadGame(game: GameUpload): Promise<void> {
  if (!account) return
  if (supabase) await supabase.saveGame(game)
  else if (client) await client.saveGame(game)
  else return
  gamesVersion++
  emit()
}

export function listGames(): Promise<SavedGame[]> {
  if (!account) return Promise.resolve([])
  if (supabase) return supabase.listGames(10)
  return client ? client.listGames(10) : Promise.resolve([])
}
