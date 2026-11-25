import AsyncStorage from '@react-native-async-storage/async-storage'
import { createApiClient, pickProgress, progressFingerprint, type Account, type GameUpload, type SavedGame } from '@shogi/api'
import { useSyncExternalStore } from 'react'
import { getProgress, replaceProgress, subscribe as subscribeProgress } from './progress'

/** URL del backend (EXPO_PUBLIC_API_URL). Sin ella, la app funciona sin cuentas. */
export const API_URL: string | null = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') || null

const KEY = 'shogi.account.v1'

let account: Account | null = null
let gamesVersion = 0
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => listener())
}

function setAccount(next: Account | null) {
  account = next
  emit()
  const write = next ? AsyncStorage.setItem(KEY, JSON.stringify(next)) : AsyncStorage.removeItem(KEY)
  write.catch(() => {})
}

const client = API_URL
  ? createApiClient({ baseUrl: API_URL, getToken: () => account?.token ?? null, onUnauthorized: () => setAccount(null) })
  : null

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
  if (!client) return
  try {
    const raw = await AsyncStorage.getItem(KEY)
    if (raw) {
      account = JSON.parse(raw) as Account
      emit()
      await syncProgress()
    }
  } catch {
    // Sin conexión o datos corruptos: se sigue sin sincronizar.
  }
}

export async function authenticate(mode: 'login' | 'register', username: string, password: string) {
  if (!client) return
  setAccount(await client[mode](username, password))
  await syncProgress()
}

export async function logout() {
  try {
    await client?.logout()
  } finally {
    setAccount(null)
  }
}

let lastSynced = ''

export async function syncProgress(): Promise<void> {
  if (!client || !account) return
  const merged = pickProgress(await client.mergeProgress(getProgress()))
  lastSynced = progressFingerprint(merged)
  replaceProgress(merged)
}

let timer: ReturnType<typeof setTimeout> | undefined
if (client) {
  subscribeProgress(() => {
    if (!account || progressFingerprint(getProgress()) === lastSynced) return
    clearTimeout(timer)
    timer = setTimeout(() => {
      syncProgress().catch(() => {})
    }, 1500)
  })
}

export async function uploadGame(game: GameUpload): Promise<void> {
  if (!client || !account) return
  await client.saveGame(game)
  gamesVersion++
  emit()
}

export function listGames(): Promise<SavedGame[]> {
  return client && account ? client.listGames(10) : Promise.resolve([])
}
