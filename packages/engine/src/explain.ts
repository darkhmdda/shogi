import {
  applyMove,
  attackedSquares,
  dropRestriction,
  isInCheck,
  isPawnDropMate,
  promotionOptions,
  sameSquare,
} from './rules'
import { OWNER_SHORT, PIECE_NAMES, pieceMovement, pieceName } from './pieces'
import { squareLabel } from './notation'
import type { HandKind, Move, Position, Square } from './types'

/**
 * Explica por qué un movimiento de tablero no es legal.
 * Devuelve null si el movimiento es legal.
 */
export function explainIllegalBoardMove(
  position: Position,
  from: Square,
  to: Square,
): string | null {
  const piece = position.board[from.row][from.col]
  if (!piece) return 'No hay ninguna pieza en esa casilla.'
  if (piece.owner !== position.turn) return 'Esa pieza es del rival: espera tu turno.'

  const target = position.board[to.row][to.col]
  if (target?.owner === piece.owner) return 'Esa casilla ya la ocupa una de tus piezas.'

  const name = pieceName(piece)
  const reachable = attackedSquares(position.board, from).some((sq) => sameSquare(sq, to))

  if (!reachable) {
    return `${capitalize(withArticle(name, true))} no puede llegar a ${squareLabel(to)}. ${pieceMovement(piece)}` +
      (isSlider(piece.kind, piece.promoted) ? ' Además, no puede saltar por encima de otras piezas.' : '')
  }

  const { mustPromote } = promotionOptions(piece, from, to)
  const next = applyMove(position, { type: 'move', from, to, promote: mustPromote })

  if (isInCheck(next.board, position.turn)) {
    if (piece.kind === 'king') {
      return `El rey no puede ir a ${squareLabel(to)}: esa casilla está atacada por el rival.`
    }

    if (isInCheck(position.board, position.turn)) {
      return 'Tu rey está en jaque y este movimiento no lo resuelve. Puedes huir con el rey, capturar la pieza atacante o interponer una pieza.'
    }

    return `${isFeminine(name) ? 'Esta' : 'Este'} ${name} está clavad${isFeminine(name) ? 'a' : 'o'}: si se mueve, tu rey quedaría expuesto a un ataque.`
  }

  return null
}

export function explainIllegalDrop(
  position: Position,
  kind: HandKind,
  to: Square,
): string | null {
  const restriction = dropRestriction(position, kind, to)
  const name = PIECE_NAMES[kind]

  switch (restriction) {
    case 'no-piece':
      return `No tienes ${isFeminine(name) ? 'ninguna' : 'ningún'} ${name} en la mano.`
    case 'occupied':
      return 'Solo puedes colocar piezas en casillas vacías.'
    case 'dead-end':
      return kind === 'knight'
        ? 'Un caballo no puede colocarse en las dos últimas filas: nunca podría volver a moverse.'
        : `${capitalize(withArticle(name, false))} no puede colocarse en la última fila: nunca podría volver a moverse.`
    case 'nifu':
      return 'Nifu (二歩): ya tienes un peón sin promocionar en esta columna. No puede haber dos.'
    case null:
      break
  }

  const next = applyMove(position, { type: 'drop', piece: kind, to })

  if (isInCheck(next.board, position.turn)) {
    return 'Tu rey está en jaque y esta colocación no lo tapa.'
  }

  if (kind === 'pawn' && isPawnDropMate(position, to)) {
    return 'Uchifuzume (打ち歩詰め): está prohibido dar jaque mate colocando un peón desde la mano. Sí puedes dar mate moviendo un peón que ya está en el tablero.'
  }

  return null
}

/** Frase educativa que describe un movimiento ya jugado (en tercera persona). */
export function describeMove(before: Position, move: Move): string {
  const after = applyMove(before, move)
  const player = OWNER_SHORT[before.turn]
  const parts: string[] = []

  if (move.type === 'drop') {
    parts.push(
      `${player} coloca ${withArticle(PIECE_NAMES[move.piece], false)} desde la mano en ${squareLabel(move.to)}.`,
    )
  } else {
    const piece = before.board[move.from.row][move.from.col]
    const captured = before.board[move.to.row][move.to.col]

    if (piece) {
      parts.push(`${player} mueve ${withArticle(pieceName(piece), false)} a ${squareLabel(move.to)}.`)
    }

    if (captured) {
      parts.push(
        `Captura ${withArticle(pieceName(captured), false)}, que pasa a su mano como ${PIECE_NAMES[captured.kind]} y podrá colocarse en un turno futuro.`,
      )
    }

    if (move.promote && piece) {
      const promoted = { kind: piece.kind, promoted: true }
      parts.push(
        `Promociona a ${pieceName(promoted)}: ${lowerFirst(pieceMovement(promoted))}`,
      )
    }
  }

  if (isInCheck(after.board, after.turn)) parts.push('¡Jaque!')

  return parts.join(' ')
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1)
}

function isSlider(kind: string, promoted?: boolean): boolean {
  if (kind === 'rook' || kind === 'bishop') return true
  return kind === 'lance' && !promoted
}

function isFeminine(name: string): boolean {
  return /^(torre|lanza|plata)/.test(name)
}

function withArticle(name: string, definite: boolean): string {
  const feminine = isFeminine(name)
  const article = definite ? (feminine ? 'la' : 'el') : (feminine ? 'una' : 'un')
  return `${article} ${name}`
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
