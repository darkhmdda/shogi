import {
  applyMove,
  BOARD_SIZE,
  findKing,
  generateLegalMoves,
  HAND_ORDER,
  isInCheck,
  otherOwner,
} from './rules'
import type { Move, Owner, PieceKind, Position } from './types'

export type Difficulty = 'easy' | 'normal' | 'hard'

const BASE_VALUE: Record<PieceKind, number> = {
  king: 0,
  pawn: 100,
  lance: 300,
  knight: 350,
  silver: 500,
  gold: 600,
  bishop: 850,
  rook: 1000,
}

const PROMOTED_VALUE: Partial<Record<PieceKind, number>> = {
  pawn: 550,
  lance: 550,
  knight: 550,
  silver: 580,
  bishop: 1150,
  rook: 1350,
}

/** Las piezas en la mano valen un poco más: se pueden colocar donde convenga. */
const HAND_BONUS = 1.1

const MATE_SCORE = 1_000_000

/** Evaluación estática desde el punto de vista de `owner`. */
export function evaluate(position: Position, owner: Owner): number {
  let score = 0

  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const piece = position.board[row][col]
      if (!piece) continue

      let value = piece.promoted
        ? PROMOTED_VALUE[piece.kind] ?? BASE_VALUE[piece.kind]
        : BASE_VALUE[piece.kind]

      // Pequeño incentivo para avanzar peones y piezas menores.
      if (!piece.promoted && piece.kind !== 'king' && piece.kind !== 'rook' && piece.kind !== 'bishop') {
        const advance = piece.owner === 'sente' ? 8 - row : row
        value += advance * 4
      }

      score += piece.owner === owner ? value : -value
    }
  }

  for (const kind of HAND_ORDER) {
    const value = BASE_VALUE[kind] * HAND_BONUS
    score += position.hands[owner][kind] * value
    score -= position.hands[otherOwner(owner)][kind] * value
  }

  score += kingSafety(position, owner) - kingSafety(position, otherOwner(owner))

  return score
}

function kingSafety(position: Position, owner: Owner): number {
  const king = findKing(position.board, owner)
  if (!king) return 0

  let defenders = 0

  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const row = king.row + dr
      const col = king.col + dc
      if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) continue

      const piece = position.board[row][col]
      if (piece?.owner === owner && (piece.kind === 'gold' || piece.kind === 'silver')) {
        defenders++
      }
    }
  }

  return defenders * 35
}

/** Puntuación rápida para ordenar jugadas: capturas, promociones y jaques primero. */
function orderingScore(position: Position, move: Move): number {
  if (move.type === 'drop') return 0

  let score = 0
  const captured = position.board[move.to.row][move.to.col]
  if (captured) score += 10 * BASE_VALUE[captured.kind] + 1000
  if (move.promote) score += 800
  return score
}

function orderMoves(position: Position, moves: Move[]): Move[] {
  return moves
    .map((move) => ({ move, score: orderingScore(position, move) }))
    .sort((a, b) => b.score - a.score)
    .map(({ move }) => move)
}

type SearchOptions = {
  /** Número máximo de jugadas exploradas en nodos interiores. */
  beam: number
}

function negamax(
  position: Position,
  depth: number,
  alpha: number,
  beta: number,
  options: SearchOptions,
  ply: number,
): number {
  if (depth === 0) return evaluate(position, position.turn)

  const moves = generateLegalMoves(position)

  if (moves.length === 0) {
    // Sin jugadas: derrota. Preferimos los mates más rápidos.
    return -MATE_SCORE + ply
  }

  let candidates = orderMoves(position, moves)

  if (depth > 1 && candidates.length > options.beam) {
    candidates = preselect(position, candidates, options.beam)
  }

  let best = -Infinity

  for (const move of candidates) {
    const score = -negamax(applyMove(position, move), depth - 1, -beta, -alpha, options, ply + 1)

    if (score > best) best = score
    if (best > alpha) alpha = best
    if (alpha >= beta) break
  }

  return best
}

/** Se queda con las `count` jugadas más prometedoras según una evaluación de un ply. */
function preselect(position: Position, moves: Move[], count: number): Move[] {
  const owner = position.turn

  return moves
    .map((move) => {
      const next = applyMove(position, move)
      let score = evaluate(next, owner)
      if (isInCheck(next.board, next.turn)) score += 150
      return { move, score }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map(({ move }) => move)
}

const SETTINGS: Record<Difficulty, { depth: number; beam: number; noise: number }> = {
  easy: { depth: 1, beam: Infinity, noise: 220 },
  normal: { depth: 2, beam: Infinity, noise: 25 },
  hard: { depth: 3, beam: 16, noise: 0 },
}

/**
 * Elige un movimiento para el bando al que le toca jugar.
 * Devuelve null si no hay jugadas legales.
 */
export function chooseMove(
  position: Position,
  difficulty: Difficulty = 'normal',
  random: () => number = Math.random,
): Move | null {
  const moves = generateLegalMoves(position)
  if (moves.length === 0) return null

  const { depth, beam, noise } = SETTINGS[difficulty]
  let candidates = orderMoves(position, moves)

  if (depth > 1 && candidates.length > beam * 2) {
    candidates = preselect(position, candidates, beam * 2)
  }

  let bestMove = candidates[0]
  let bestScore = -Infinity

  for (const move of candidates) {
    const score =
      -negamax(applyMove(position, move), depth - 1, -Infinity, Infinity, { beam }, 1) +
      (noise > 0 ? (random() - 0.5) * 2 * noise : 0)

    if (score > bestScore) {
      bestScore = score
      bestMove = move
    }
  }

  return bestMove
}
