import { fromUsi } from './notation'
import {
  applyMove,
  attackedSquares,
  BOARD_SIZE,
  createInitialPosition,
  findKing,
  generateLegalMoves,
  HAND_ORDER,
  isInCheck,
  legalMovesFrom,
  movesEqual,
  otherOwner,
  positionKey,
} from './rules'
import type { Move, Owner, PieceKind, Position, Square } from './types'

export type Difficulty = 'easy' | 'normal' | 'hard'

// ---------------------------------------------------------------------------
// Evaluación
// ---------------------------------------------------------------------------

export const PIECE_VALUE: Record<PieceKind, number> = {
  king: 0,
  pawn: 100,
  lance: 320,
  knight: 360,
  silver: 520,
  gold: 600,
  bishop: 880,
  rook: 1020,
}

const PROMOTED_VALUE: Partial<Record<PieceKind, number>> = {
  pawn: 560,
  lance: 560,
  knight: 570,
  silver: 590,
  bishop: 1180,
  rook: 1380,
}

/** Bonificación por pieza en la mano (se puede colocar donde convenga). */
const HAND_VALUE: Record<Exclude<PieceKind, 'king'>, number> = {
  pawn: 115,
  lance: 350,
  knight: 400,
  silver: 590,
  gold: 680,
  bishop: 980,
  rook: 1150,
}

export const MATE_SCORE = 1_000_000
const MATE_THRESHOLD = MATE_SCORE - 1000

function pieceValue(kind: PieceKind, promoted?: boolean): number {
  return promoted ? PROMOTED_VALUE[kind] ?? PIECE_VALUE[kind] : PIECE_VALUE[kind]
}

/** Distancia de una fila al fondo propio: 0 = fila de salida, 8 = fondo rival. */
function advance(owner: Owner, row: number): number {
  return owner === 'sente' ? 8 - row : row
}

/** Evaluación estática desde el punto de vista de `owner`. */
export function evaluate(position: Position, owner: Owner): number {
  const board = position.board
  let score = 0
  const kings: Record<Owner, Square | null> = {
    sente: findKing(board, 'sente'),
    gote: findKing(board, 'gote'),
  }

  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const piece = board[row][col]
      if (!piece) continue

      let value = pieceValue(piece.kind, piece.promoted)
      const adv = advance(piece.owner, row)
      const ownKing = kings[piece.owner]
      const enemyKing = kings[otherOwner(piece.owner)]

      switch (piece.kind) {
        case 'king':
          // El rey prefiere quedarse en sus dos primeras filas y lejos del centro abierto.
          value += adv === 1 ? 30 : adv === 0 ? 20 : adv === 2 ? -10 : -60 - adv * 10
          break
        case 'pawn':
          if (!piece.promoted) value += Math.min(adv - 2, 3) * 6
          break
        case 'gold':
        case 'silver':
          // Los generales defienden mejor cerca de su rey.
          if (ownKing) {
            const distance = Math.max(Math.abs(ownKing.row - row), Math.abs(ownKing.col - col))
            if (distance <= 1) value += 45
            else if (distance === 2) value += 20
          }
          break
        case 'rook':
        case 'bishop':
          value += attackedSquares(board, { row, col }).length * 4
          break
        default:
          break
      }

      // Piezas atacantes cerca del rey rival.
      if (enemyKing && piece.kind !== 'king') {
        const distance = Math.max(Math.abs(enemyKing.row - row), Math.abs(enemyKing.col - col))
        if (distance <= 2) value += piece.kind === 'pawn' && !piece.promoted ? 10 : 30
      }

      // Las piezas promocionadas cerca del rival valen más.
      if (piece.promoted && adv >= 6) value += 20

      score += piece.owner === owner ? value : -value
    }
  }

  const opponent = otherOwner(owner)
  for (const kind of HAND_ORDER) {
    score += position.hands[owner][kind] * HAND_VALUE[kind]
    score -= position.hands[opponent][kind] * HAND_VALUE[kind]
  }

  return score
}

// ---------------------------------------------------------------------------
// Libro de aperturas
// ---------------------------------------------------------------------------

export const OPENING_LINES = [
  '7g7f 3c3d 2g2f 4c4d 2f2e 2b3c 3i4h 8b2b',
  '7g7f 3c3d 2g2f 8c8d 2f2e 8d8e 6i7h 4a3b 2e2d 2c2d 2h2d',
  '7g7f 8c8d 2g2f 8d8e 8h7g 3c3d 7i8h 2b7g+ 8h7g',
  '7g7f 8c8d 6g6f 3c3d 2h6h 7a6b',
  '2g2f 8c8d 2f2e 8d8e 6i7h 4a3b 2e2d 2c2d 2h2d',
  '2g2f 3c3d 7g7f 4c4d 3i4h 3a3b',
  '5g5f 5c5d 2g2f 8c8d',
  '7g7f 5c5d 2g2f 5d5e 5i6h',
]

let openingBook: Map<string, Move[]> | null = null

function getOpeningBook(): Map<string, Move[]> {
  if (openingBook) return openingBook
  const book = new Map<string, Move[]>()

  for (const line of OPENING_LINES) {
    let position = createInitialPosition()

    for (const text of line.split(' ')) {
      const move = fromUsi(text)
      if (!move) break
      const legal = generateLegalMoves(position)
      if (!legal.some((candidate) => movesEqual(candidate, move))) break

      const key = positionKey(position)
      const entries = book.get(key) ?? []
      if (!entries.some((entry) => movesEqual(entry, move))) entries.push(move)
      book.set(key, entries)
      position = applyMove(position, move)
    }
  }

  openingBook = book
  return book
}

export function bookMoves(position: Position): Move[] {
  return getOpeningBook().get(positionKey(position)) ?? []
}

// ---------------------------------------------------------------------------
// Búsqueda
// ---------------------------------------------------------------------------

type TTEntry = { depth: number; score: number; flag: 'exact' | 'lower' | 'upper'; best: Move | null }

class Timeout extends Error {}

type SearchContext = {
  deadline: number
  nodes: number
  table: Map<string, TTEntry>
  killers: Move[][]
}

function moveScore(position: Position, move: Move, ctx: SearchContext, ply: number, ttMove: Move | null): number {
  if (ttMove && movesEqual(move, ttMove)) return 1_000_000

  if (move.type === 'move') {
    const captured = position.board[move.to.row][move.to.col]
    const mover = position.board[move.from.row][move.from.col]
    let score = 0
    if (captured) {
      score += 100_000 + pieceValue(captured.kind, captured.promoted) * 10 -
        (mover ? pieceValue(mover.kind, mover.promoted) : 0)
    }
    if (move.promote) score += 50_000
    if (ctx.killers[ply]?.some((killer) => movesEqual(killer, move))) score += 40_000
    return score
  }

  if (ctx.killers[ply]?.some((killer) => movesEqual(killer, move))) return 40_000
  // Las colocaciones se exploran al final, las de piezas valiosas antes.
  return -10_000 + PIECE_VALUE[move.piece] / 10
}

function orderMoves(position: Position, moves: Move[], ctx: SearchContext, ply: number, ttMove: Move | null): Move[] {
  return moves
    .map((move) => ({ move, score: moveScore(position, move, ctx, ply, ttMove) }))
    .sort((a, b) => b.score - a.score)
    .map(({ move }) => move)
}

function checkTime(ctx: SearchContext) {
  ctx.nodes++
  if ((ctx.nodes & 1023) === 0 && performance.now() > ctx.deadline) throw new Timeout()
}

function captureMoves(position: Position): Move[] {
  const moves: Move[] = []
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const piece = position.board[row][col]
      if (piece?.owner !== position.turn) continue
      for (const move of legalMovesFrom(position, { row, col })) {
        if (position.board[move.to.row][move.to.col] !== null || move.promote) moves.push(move)
      }
    }
  }
  return moves
}

/** Búsqueda de capturas para evitar el "efecto horizonte". */
function quiescence(position: Position, alpha: number, beta: number, ctx: SearchContext, ply: number, qdepth: number): number {
  checkTime(ctx)

  const inCheck = isInCheck(position.board, position.turn)

  if (inCheck) {
    const moves = generateLegalMoves(position)
    if (moves.length === 0) return -MATE_SCORE + ply
    if (qdepth <= 0) return evaluate(position, position.turn)

    let best = -Infinity
    for (const move of orderMoves(position, moves, ctx, ply, null)) {
      const score = -quiescence(applyMove(position, move), -beta, -alpha, ctx, ply + 1, qdepth - 1)
      if (score > best) best = score
      if (best > alpha) alpha = best
      if (alpha >= beta) break
    }
    return best
  }

  const standPat = evaluate(position, position.turn)
  if (standPat >= beta || qdepth <= 0) return standPat
  if (standPat > alpha) alpha = standPat

  for (const move of orderMoves(position, captureMoves(position), ctx, ply, null)) {
    const score = -quiescence(applyMove(position, move), -beta, -alpha, ctx, ply + 1, qdepth - 1)
    if (score >= beta) return score
    if (score > alpha) alpha = score
  }

  return alpha
}

function negamax(
  position: Position,
  depth: number,
  alpha: number,
  beta: number,
  ctx: SearchContext,
  ply: number,
): number {
  checkTime(ctx)

  const inCheck = isInCheck(position.board, position.turn)
  // Extensión de jaque: ayuda a ver mates forzados.
  if (inCheck && ply < 10) depth++

  if (depth <= 0) return quiescence(position, alpha, beta, ctx, ply, 6)

  const key = positionKey(position)
  const entry = ctx.table.get(key)
  const originalAlpha = alpha

  if (entry && entry.depth >= depth && Math.abs(entry.score) < MATE_THRESHOLD) {
    if (entry.flag === 'exact') return entry.score
    if (entry.flag === 'lower' && entry.score >= beta) return entry.score
    if (entry.flag === 'upper' && entry.score <= alpha) return entry.score
  }

  const moves = generateLegalMoves(position)
  if (moves.length === 0) return -MATE_SCORE + ply

  let best = -Infinity
  let bestMove: Move | null = null

  for (const move of orderMoves(position, moves, ctx, ply, entry?.best ?? null)) {
    const score = -negamax(applyMove(position, move), depth - 1, -beta, -alpha, ctx, ply + 1)

    if (score > best) {
      best = score
      bestMove = move
    }
    if (best > alpha) alpha = best
    if (alpha >= beta) {
      const isQuiet = move.type === 'drop' || position.board[move.to.row][move.to.col] === null
      if (isQuiet) {
        const killers = ctx.killers[ply] ?? []
        ctx.killers[ply] = [move, ...killers.filter((k) => !movesEqual(k, move))].slice(0, 2)
      }
      break
    }
  }

  ctx.table.set(key, {
    depth,
    score: best,
    flag: best <= originalAlpha ? 'upper' : best >= beta ? 'lower' : 'exact',
    best: bestMove,
  })

  return best
}

type Settings = { maxDepth: number; timeMs: number; noise: number; useBook: boolean }

const SETTINGS: Record<Difficulty, Settings> = {
  easy: { maxDepth: 1, timeMs: 300, noise: 160, useBook: false },
  normal: { maxDepth: 3, timeMs: 1000, noise: 12, useBook: true },
  hard: { maxDepth: 8, timeMs: 2500, noise: 0, useBook: true },
}

export type SearchInfo = { move: Move | null; depth: number; score: number; nodes: number; fromBook: boolean }

/** Búsqueda iterativa: profundiza hasta agotar el tiempo o la profundidad máxima. */
export function search(
  position: Position,
  difficulty: Difficulty = 'normal',
  random: () => number = Math.random,
  overrides: Partial<Settings> = {},
): SearchInfo {
  const settings = { ...SETTINGS[difficulty], ...overrides }
  const moves = generateLegalMoves(position)
  if (moves.length === 0) return { move: null, depth: 0, score: -MATE_SCORE, nodes: 0, fromBook: false }

  if (settings.useBook) {
    const book = bookMoves(position)
    if (book.length > 0) {
      return { move: book[Math.floor(random() * book.length)], depth: 0, score: 0, nodes: 0, fromBook: true }
    }
  }

  const ctx: SearchContext = {
    deadline: performance.now() + settings.timeMs,
    nodes: 0,
    table: new Map(),
    killers: [],
  }

  let bestMove = moves[0]
  let bestScore = -Infinity
  let completedDepth = 0
  let rootMoves = orderMoves(position, moves, ctx, 0, null)

  for (let depth = 1; depth <= settings.maxDepth; depth++) {
    try {
      let iterationBest: Move = rootMoves[0]
      let iterationScore = -Infinity
      let alpha = -Infinity
      const scored: { move: Move; score: number }[] = []

      for (const move of rootMoves) {
        // Con ruido se necesita la puntuación exacta de cada jugada; sin ruido
        // basta con saber si mejora la mejor encontrada (poda alfa en la raíz).
        const bound = settings.noise > 0 ? -Infinity : alpha
        const raw = -negamax(applyMove(position, move), depth - 1, -Infinity, -bound, ctx, 1)
        if (raw > alpha) alpha = raw
        const score = raw + (settings.noise > 0 ? (random() - 0.5) * 2 * settings.noise : 0)
        scored.push({ move, score })
        if (score > iterationScore) {
          iterationScore = score
          iterationBest = move
        }
      }

      bestMove = iterationBest
      bestScore = iterationScore
      completedDepth = depth
      // La mejor jugada de esta iteración se explora primero en la siguiente.
      rootMoves = scored.sort((a, b) => b.score - a.score).map(({ move }) => move)

      if (Math.abs(bestScore) >= MATE_THRESHOLD) break
    } catch (error) {
      if (error instanceof Timeout) break
      throw error
    }
  }

  return { move: bestMove, depth: completedDepth, score: bestScore, nodes: ctx.nodes, fromBook: false }
}

/** Elige un movimiento para el bando al que le toca jugar (null si no hay jugadas). */
export function chooseMove(
  position: Position,
  difficulty: Difficulty = 'normal',
  random: () => number = Math.random,
): Move | null {
  return search(position, difficulty, random).move
}
