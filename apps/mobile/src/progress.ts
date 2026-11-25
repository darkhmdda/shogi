import AsyncStorage from '@react-native-async-storage/async-storage'
import { useSyncExternalStore } from 'react'

/** Progreso del usuario guardado en el dispositivo (mismo formato que la web y el backend). */
export type Progress = {
  lessons: Record<string, string>
  puzzles: Record<string, string>
  games: { played: number; won: number; lost: number; drawn: number }
}

const KEY = 'shogi.progress.v1'

const empty = (): Progress => ({ lessons: {}, puzzles: {}, games: { played: 0, won: 0, lost: 0, drawn: 0 } })

let current: Progress = empty()
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => listener())
}

function save(next: Progress) {
  current = next
  emit()
  AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {
    // Si falla el almacenamiento, el progreso dura hasta cerrar la app.
  })
}

/** Carga el progreso guardado. Se llama una vez al arrancar. */
export async function loadProgress(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Progress>
      current = { ...empty(), ...parsed, games: { ...empty().games, ...parsed.games } }
      emit()
    }
  } catch {
    // Datos corruptos o sin almacenamiento: se empieza de cero.
  }
}

export function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useProgress(): Progress {
  return useSyncExternalStore(subscribe, () => current)
}

export function getProgress(): Progress {
  return current
}

/** Sustituye el progreso (al sincronizar con el servidor). */
export function replaceProgress(next: Progress) {
  save({ ...empty(), ...next })
}

export function completeLesson(id: string) {
  if (!current.lessons[id]) save({ ...current, lessons: { ...current.lessons, [id]: new Date().toISOString() } })
}

export function completePuzzle(id: string) {
  if (!current.puzzles[id]) save({ ...current, puzzles: { ...current.puzzles, [id]: new Date().toISOString() } })
}

export function recordGame(outcome: 'won' | 'lost' | 'drawn') {
  save({ ...current, games: { ...current.games, played: current.games.played + 1, [outcome]: current.games[outcome] + 1 } })
}

export function resetProgress() {
  save(empty())
}
