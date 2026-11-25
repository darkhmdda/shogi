import { useSyncExternalStore } from 'react'
import { getProgress, replaceProgress, subscribe as subscribeProgress, type Progress } from './progress'

/** URL del backend. Si no está configurada, las funciones de cuenta se ocultan. */
export const API_URL: string | null = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || null

export type Account = { username: string; token: string } | null

const KEY = 'shogi.account.v1'

function loadAccount(): Account {
  try {
    const raw = window.localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Account) : null
  } catch {
    return null
  }
}

let account: Account = typeof window === 'undefined' ? null : loadAccount()
const listeners = new Set<() => void>()

function setAccount(next: Account) {
  account = next
  try {
    if (next) window.localStorage.setItem(KEY, JSON.stringify(next))
    else window.localStorage.removeItem(KEY)
  } catch {
    // Sin almacenamiento: la sesión dura hasta recargar.
  }
  listeners.forEach((listener) => listener())
}

export function useAccount(): Account {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => account,
    () => account,
  )
}

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!API_URL) throw new ApiError(0, 'No hay servidor configurado.')

  const headers = new Headers(options.headers)
  headers.set('Content-Type', 'application/json')
  if (account) headers.set('Authorization', `Bearer ${account.token}`)

  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, { ...options, headers })
  } catch {
    throw new ApiError(0, 'No se pudo conectar con el servidor.')
  }

  if (response.status === 401 && account) setAccount(null)

  if (!response.ok) {
    let detail = `Error ${response.status}`
    try {
      const body = (await response.json()) as { detail?: unknown }
      if (typeof body.detail === 'string') detail = body.detail
      else if (Array.isArray(body.detail)) detail = 'Revisa los datos: usuario de 3 a 32 caracteres y contraseña de al menos 8.'
    } catch {
      // Respuesta sin JSON.
    }
    throw new ApiError(response.status, detail)
  }

  return response.status === 204 ? (undefined as T) : ((await response.json()) as T)
}

export async function authenticate(mode: 'login' | 'register', username: string, password: string) {
  const result = await request<{ token: string; username: string }>(`/auth/${mode}`, {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
  setAccount(result)
  await syncProgress()
}

export async function logout() {
  try {
    await request('/auth/logout', { method: 'POST' })
  } finally {
    setAccount(null)
  }
}

let lastSynced = ''

/** Envía el progreso local y adopta el resultado fusionado del servidor. */
export async function syncProgress(): Promise<void> {
  if (!account) return
  const merged = await request<Progress>('/progress', { method: 'PUT', body: JSON.stringify(getProgress()) })
  lastSynced = JSON.stringify({ lessons: merged.lessons, puzzles: merged.puzzles, games: merged.games })
  replaceProgress({ lessons: merged.lessons, puzzles: merged.puzzles, games: merged.games })
}

// Sincronización automática (con un pequeño retardo) cuando cambia el progreso.
let timer: number | undefined
if (typeof window !== 'undefined' && API_URL) {
  subscribeProgress(() => {
    if (!account) return
    const current = getProgress()
    if (JSON.stringify({ lessons: current.lessons, puzzles: current.puzzles, games: current.games }) === lastSynced) return
    window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      syncProgress().catch(() => {
        // Sin conexión: se volverá a intentar en el próximo cambio.
      })
    }, 1500)
  })
}

export type SavedGameOut = {
  id: number
  sfen: string
  moves: string[]
  winner: 'sente' | 'gote' | null
  reason: string | null
  mode: 'ai' | 'local'
  difficulty: 'easy' | 'normal' | 'hard' | null
  human_side: 'sente' | 'gote' | null
  created_at: string
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

export async function uploadGame(game: Omit<SavedGameOut, 'id' | 'created_at'>): Promise<void> {
  if (!account) return
  await request('/games', { method: 'POST', body: JSON.stringify(game) })
  gamesVersion++
  gamesListeners.forEach((listener) => listener())
}

export function listGames(): Promise<SavedGameOut[]> {
  return request<SavedGameOut[]>('/games?limit=10')
}
