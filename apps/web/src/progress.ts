import { useSyncExternalStore } from 'react'

/** Progreso del usuario, guardado en el navegador. */
export type Progress = {
  lessons: Record<string, string>
  puzzles: Record<string, string>
  games: { played: number; won: number; lost: number; drawn: number }
}

const KEY = 'shogi.progress.v1'

function emptyProgress(): Progress {
  return { lessons: {}, puzzles: {}, games: { played: 0, won: 0, lost: 0, drawn: 0 } }
}

function load(): Progress {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return emptyProgress()
    const parsed = JSON.parse(raw) as Partial<Progress>
    return { ...emptyProgress(), ...parsed, games: { ...emptyProgress().games, ...parsed.games } }
  } catch {
    return emptyProgress()
  }
}

let current: Progress = typeof window === 'undefined' ? emptyProgress() : load()
const listeners = new Set<() => void>()

function save(next: Progress) {
  current = next
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Sin almacenamiento (modo privado): el progreso solo dura esta sesión.
  }
  listeners.forEach((listener) => listener())
}

export function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useProgress(): Progress {
  return useSyncExternalStore(subscribe, () => current, () => current)
}

export function getProgress(): Progress {
  return current
}

export function completeLesson(id: string) {
  if (current.lessons[id]) return
  save({ ...current, lessons: { ...current.lessons, [id]: new Date().toISOString() } })
}

export function completePuzzle(id: string) {
  if (current.puzzles[id]) return
  save({ ...current, puzzles: { ...current.puzzles, [id]: new Date().toISOString() } })
}

export function recordGame(outcome: 'won' | 'lost' | 'drawn') {
  save({
    ...current,
    games: { ...current.games, played: current.games.played + 1, [outcome]: current.games[outcome] + 1 },
  })
}

export function resetProgress() {
  save(emptyProgress())
}

/** Sustituye el progreso (por ejemplo, al sincronizar con el servidor). */
export function replaceProgress(next: Progress) {
  save({ ...emptyProgress(), ...next })
}
