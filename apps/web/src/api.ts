import {
  createApiClient,
  pickProgress,
  progressFingerprint,
  type Account,
  type GameUpload,
  type SavedGame,
} from '@shogi/api'
import { useSyncExternalStore } from 'react'
import { getProgress, replaceProgress, subscribe as subscribeProgress } from './progress'

export { ApiError, type OnlineState, type SavedGame } from '@shogi/api'

/** URL del backend. Si no está configurada, las funciones de cuenta se ocultan. */
export const API_URL: string | null =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || null

const KEY = 'shogi.account.v1'

function loadAccount(): Account | null {
  try {
    const raw = window.localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Account) : null
  } catch {
    return null
  }
}

let account: Account | null = typeof window === 'undefined' ? null : loadAccount()
const listeners = new Set<() => void>()

function setAccount(next: Account | null) {
  account = next
  try {
    if (next) window.localStorage.setItem(KEY, JSON.stringify(next))
    else window.localStorage.removeItem(KEY)
  } catch {
    // Sin almacenamiento: la sesión dura hasta recargar.
  }
  listeners.forEach((listener) => listener())
}

const client = API_URL
  ? createApiClient({ baseUrl: API_URL, getToken: () => account?.token ?? null, onUnauthorized: () => setAccount(null) })
  : null

/** Cliente de la API (null si no hay servidor configurado). */
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

export async function authenticate(mode: 'login' | 'register', username: string, password: string) {
  if (!client) return
  setAccount(await client[mode](username, password))
  await syncProgress()
}

export async function changePassword(current: string, next: string) {
  if (!client) return
  setAccount(await client.changePassword(current, next))
}

/** Borra la cuenta en el servidor. El progreso local del navegador se conserva. */
export async function deleteAccount(password: string) {
  if (!client) return
  await client.deleteAccount(password)
  setAccount(null)
}

export async function logout() {
  try {
    await client?.logout()
  } finally {
    setAccount(null)
  }
}

let lastSynced = ''

/** Envía el progreso local y adopta el resultado fusionado del servidor. */
export async function syncProgress(): Promise<void> {
  if (!client || !account) return
  const merged = pickProgress(await client.mergeProgress(getProgress()))
  lastSynced = progressFingerprint(merged)
  replaceProgress(merged)
}

// Sincronización automática (con un pequeño retardo) cuando cambia el progreso.
let timer: number | undefined
if (typeof window !== 'undefined' && client) {
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
  if (!client || !account) return
  await client.saveGame(game)
  gamesVersion++
  gamesListeners.forEach((listener) => listener())
}

export function listGames(): Promise<SavedGame[]> {
  return client ? client.listGames(10) : Promise.resolve([])
}
