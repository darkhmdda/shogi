import { applyMove, BOARD_SIZE, generateLegalMoves, HAND_ORDER, isInCheck } from './rules'
import type { HandKind, Move, Owner, Position } from './types'

/** Jugadas legales que dan jaque. */
export function checkingMoves(position: Position): Move[] {
  return generateLegalMoves(position).filter((move) => {
    const next = applyMove(position, move)
    return isInCheck(next.board, next.turn)
  })
}

/**
 * Busca un mate forzado en como máximo `plies` medias jugadas (1, 3, 5…)
 * con reglas de tsume: el atacante debe dar jaque en cada jugada.
 * Devuelve la línea principal (con la defensa más larga) o null.
 */
export function solveMate(position: Position, plies: number): Move[] | null {
  for (let depth = 1; depth <= plies; depth += 2) {
    const line = attack(position, depth)
    if (line) return line
  }
  return null
}

function attack(position: Position, plies: number): Move[] | null {
  if (plies <= 0) return null

  for (const move of checkingMoves(position)) {
    const defense = defend(applyMove(position, move), plies - 1)
    if (defense) return [move, ...defense]
  }

  return null
}

/** Devuelve la defensa más larga si todas las respuestas pierden; null si alguna se salva. */
function defend(position: Position, plies: number): Move[] | null {
  const replies = generateLegalMoves(position)
  if (replies.length === 0) return []
  if (plies <= 0) return null

  let longest: Move[] | null = null

  for (const reply of replies) {
    const line = attack(applyMove(position, reply), plies - 1)
    if (!line) return null
    if (!longest || line.length + 1 > longest.length) longest = [reply, ...line]
  }

  return longest
}

/**
 * Respuesta del defensor en un problema: la que más alarga el mate,
 * o cualquiera que escape si el atacante se ha equivocado.
 */
export function defenderReply(position: Position, remainingPlies: number): Move | null {
  const replies = generateLegalMoves(position)
  if (replies.length === 0) return null

  let best: Move = replies[0]
  let bestLength = -1

  for (const reply of replies) {
    const line = attack(applyMove(position, reply), remainingPlies)
    if (!line) return reply
    if (line.length > bestLength) {
      bestLength = line.length
      best = reply
    }
  }

  return best
}

const FULL_SET: Record<HandKind, number> = {
  rook: 2, bishop: 2, gold: 4, silver: 4, knight: 4, lance: 4, pawn: 18,
}

/** Regla clásica del tsume: todas las piezas que no están en juego son del defensor. */
export function giveRemainingToDefender(position: Position, defender: Owner = 'gote'): Position {
  const used: Record<HandKind, number> = { rook: 0, bishop: 0, gold: 0, silver: 0, knight: 0, lance: 0, pawn: 0 }

  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const piece = position.board[row][col]
      if (piece && piece.kind !== 'king') used[piece.kind as HandKind]++
    }
  }

  const attacker = defender === 'gote' ? 'sente' : 'gote'
  for (const kind of HAND_ORDER) used[kind] += position.hands[attacker][kind]

  const hands = { ...position.hands, [defender]: { ...position.hands[defender] } }
  for (const kind of HAND_ORDER) hands[defender][kind] = Math.max(0, FULL_SET[kind] - used[kind])

  return { ...position, hands }
}
