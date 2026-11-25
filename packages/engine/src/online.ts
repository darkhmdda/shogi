import { playMove } from './game'
import { fromUsi } from './notation'
import { deserializeGame } from './record'
import type { GameResult, Owner } from './types'

/** Lo que el servidor guarda de una partida en línea. */
export type OnlineGameRecord = {
  sente_id: string | null
  gote_id: string | null
  start_sfen: string
  moves: string[]
  status: 'waiting' | 'active' | 'finished'
}

export type OnlineMoveOutcome =
  | {
      ok: true
      moves: string[]
      status: 'active' | 'finished'
      winner: Owner | null
      reason: GameResult['reason'] | null
    }
  | { ok: false; status: number; error: string }

/**
 * Valida una jugada de una partida en línea con las reglas completas del motor.
 * La usa el servidor (Edge Function de Supabase) antes de guardar nada.
 *
 * @param ply número de jugadas que el cliente cree que hay (evita jugadas
 *   duplicadas o desfasadas si dos peticiones llegan a la vez).
 */
export function validateOnlineMove(
  game: OnlineGameRecord,
  userId: string,
  usi: string,
  ply: number,
): OnlineMoveOutcome {
  const side: Owner | null = game.sente_id === userId ? 'sente' : game.gote_id === userId ? 'gote' : null
  if (!side) return { ok: false, status: 403, error: 'No juegas esta partida.' }
  if (game.status === 'waiting') return { ok: false, status: 409, error: 'Todavía no ha llegado tu rival.' }
  if (game.status !== 'active') return { ok: false, status: 409, error: 'La partida ya ha terminado.' }
  if (ply !== game.moves.length) {
    return { ok: false, status: 409, error: 'La partida ha cambiado: actualiza el tablero.' }
  }

  let state
  try {
    state = deserializeGame({ sfen: game.start_sfen, moves: game.moves })
  } catch {
    return { ok: false, status: 500, error: 'La partida guardada no es válida.' }
  }

  if (state.position.turn !== side) return { ok: false, status: 409, error: 'No es tu turno.' }

  const move = typeof usi === 'string' && /^[1-9][a-i][1-9][a-i]\+?$|^[RBGSNLP]\*[1-9][a-i]$/.test(usi) ? fromUsi(usi) : null
  if (!move) return { ok: false, status: 422, error: 'Jugada mal escrita.' }

  try {
    const next = playMove(state, move)
    return {
      ok: true,
      moves: [...game.moves, usi],
      status: next.result ? 'finished' : 'active',
      winner: next.result?.winner ?? null,
      reason: next.result?.reason ?? null,
    }
  } catch {
    return { ok: false, status: 422, error: 'Jugada ilegal.' }
  }
}
