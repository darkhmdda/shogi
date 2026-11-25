import { promotionOptions } from './rules'
import { PIECE_KANJI, PROMOTED_KANJI } from './pieces'
import type { Move, Position, Square } from './types'

export const FILE_LABELS = [9, 8, 7, 6, 5, 4, 3, 2, 1]
export const RANK_LABELS = ['一', '二', '三', '四', '五', '六', '七', '八', '九']

export function squareLabel(square: Square): string {
  return `${FILE_LABELS[square.col]}${RANK_LABELS[square.row]}`
}

/** Etiqueta en cifras (por ejemplo, 7-6) para lectores de pantalla. */
export function squareSpoken(square: Square): string {
  return `columna ${FILE_LABELS[square.col]}, fila ${square.row + 1}`
}

/**
 * Notación japonesa tradicional (kifu): ▲7六歩, △同角, ▲3三角成, ▲5五歩打…
 */
export function formatMove(
  position: Position,
  move: Move,
  previousTo: Square | null = null,
): string {
  const mark = position.turn === 'sente' ? '▲' : '△'
  const destination =
    previousTo && previousTo.row === move.to.row && previousTo.col === move.to.col
      ? '同'
      : squareLabel(move.to)

  if (move.type === 'drop') {
    return `${mark}${destination}${PIECE_KANJI[move.piece]}打`
  }

  const piece = position.board[move.from.row][move.from.col]
  if (!piece) return `${mark}${destination}?`

  const kanji = piece.kind === 'king'
    ? '玉'
    : piece.promoted
      ? PROMOTED_KANJI[piece.kind] ?? PIECE_KANJI[piece.kind]
      : PIECE_KANJI[piece.kind]

  let suffix = ''
  if (move.promote) {
    suffix = '成'
  } else if (promotionOptions(piece, move.from, move.to).canPromote) {
    suffix = '不成'
  }

  return `${mark}${destination}${kanji}${suffix}`
}

/** Notación USI (la que usan los motores): 7g7f, 8h2b+, P*5e. */
export function toUsi(move: Move): string {
  const sq = (s: Square) =>
    `${FILE_LABELS[s.col]}${String.fromCharCode(97 + s.row)}`

  if (move.type === 'drop') {
    const letters = {
      rook: 'R', bishop: 'B', gold: 'G', silver: 'S', knight: 'N', lance: 'L', pawn: 'P',
    } as const
    return `${letters[move.piece]}*${sq(move.to)}`
  }

  return `${sq(move.from)}${sq(move.to)}${move.promote ? '+' : ''}`
}

