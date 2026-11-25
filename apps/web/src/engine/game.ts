import {
  applyMove,
  createInitialPosition,
  generateLegalMoves,
  hasAnyLegalMove,
  isInCheck,
  movesEqual,
  otherOwner,
  positionKey,
} from './rules'
import type { GameResult, Move, Owner, Position } from './types'

export type HistoryEntry = {
  move: Move
  /** Posición antes de jugar el movimiento. */
  before: Position
  /** Si el movimiento dejó al rival en jaque. */
  givesCheck: boolean
  /** Pieza capturada, si la hubo. */
  captured: string | null
}

export type GameState = {
  start: Position
  position: Position
  history: HistoryEntry[]
  /** Claves de todas las posiciones alcanzadas, incluida la inicial. */
  keys: string[]
  result: GameResult | null
}

export function newGame(start: Position = createInitialPosition()): GameState {
  const state: GameState = {
    start,
    position: start,
    history: [],
    keys: [positionKey(start)],
    result: null,
  }

  return { ...state, result: evaluateResult(state) }
}

export function playMove(state: GameState, move: Move): GameState {
  if (state.result) throw new Error('La partida ya ha terminado.')

  const legal = generateLegalMoves(state.position)
  if (!legal.some((candidate) => movesEqual(candidate, move))) {
    throw new Error('Movimiento ilegal.')
  }

  const before = state.position
  const position = applyMove(before, move)
  const capturedPiece =
    move.type === 'move' ? before.board[move.to.row][move.to.col] : null

  const entry: HistoryEntry = {
    move,
    before,
    givesCheck: isInCheck(position.board, position.turn),
    captured: capturedPiece ? capturedPiece.kind : null,
  }

  const next: GameState = {
    start: state.start,
    position,
    history: [...state.history, entry],
    keys: [...state.keys, positionKey(position)],
    result: null,
  }

  return { ...next, result: evaluateResult(next) }
}

/** Deshace los últimos `plies` movimientos. */
export function undo(state: GameState, plies = 1): GameState {
  const count = Math.min(plies, state.history.length)
  if (count === 0) return state

  const history = state.history.slice(0, state.history.length - count)
  const position = state.history[history.length].before

  return {
    start: state.start,
    position,
    history,
    keys: state.keys.slice(0, state.keys.length - count),
    result: null,
  }
}

export function resign(state: GameState, loser: Owner): GameState {
  return { ...state, result: { winner: otherOwner(loser), reason: 'resignation' } }
}

function evaluateResult(state: GameState): GameResult | null {
  const { position } = state

  if (!hasAnyLegalMove(position)) {
    // En shōgi, quedarse sin jugadas legales siempre es derrota.
    return {
      winner: otherOwner(position.turn),
      reason: isInCheck(position.board, position.turn) ? 'checkmate' : 'no-moves',
    }
  }

  return detectSennichite(state)
}

/**
 * Sennichite: si la misma posición aparece cuatro veces, la partida es
 * tablas, salvo que uno de los bandos haya dado jaque en todas sus
 * jugadas del ciclo; en ese caso, ese bando pierde.
 */
function detectSennichite(state: GameState): GameResult | null {
  const current = state.keys[state.keys.length - 1]
  const occurrences: number[] = []

  state.keys.forEach((key, index) => {
    if (key === current) occurrences.push(index)
  })

  if (occurrences.length < 4) return null

  const firstIndex = occurrences[0]
  const cycle = state.history.slice(firstIndex)

  for (const owner of ['sente', 'gote'] as const) {
    const ownMoves = cycle.filter((entry) => entry.before.turn === owner)
    if (ownMoves.length > 0 && ownMoves.every((entry) => entry.givesCheck)) {
      return { winner: otherOwner(owner), reason: 'perpetual-check' }
    }
  }

  return { winner: null, reason: 'repetition' }
}

export function isCheck(state: GameState): boolean {
  return isInCheck(state.position.board, state.position.turn)
}
