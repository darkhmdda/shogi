import { emptyBoard, emptyHands } from './rules'
import type { Board, HandKind, Owner, Piece, Position } from './types'

/** Pieza colocada indicando la casilla en notación de shōgi: columna 1-9, fila 1-9. */
type Placement = [file: number, rank: number, piece: Piece]

function boardFrom(placements: Placement[]): Board {
  const board = emptyBoard()
  for (const [file, rank, piece] of placements) {
    board[rank - 1][9 - file] = piece
  }
  return board
}

function position(
  turn: Owner,
  placements: Placement[],
  senteHand: Partial<Record<HandKind, number>> = {},
  goteHand: Partial<Record<HandKind, number>> = {},
): Position {
  const hands = emptyHands()
  Object.assign(hands.sente, senteHand)
  Object.assign(hands.gote, goteHand)
  return { board: boardFrom(placements), hands, turn }
}

const s = (kind: Piece['kind'], promoted = false): Piece => ({ kind, owner: 'sente', promoted })
const g = (kind: Piece['kind'], promoted = false): Piece => ({ kind, owner: 'gote', promoted })

export type PracticePosition = {
  id: string
  title: string
  description: string
  /** Si existe, el ejercicio se resuelve al dar jaque mate. */
  goal?: 'mate'
  create: () => Position
}

export const PRACTICE_POSITIONS: PracticePosition[] = [
  {
    id: 'check',
    title: 'Salir del jaque',
    description:
      'La torre azul da jaque al rey rojo. Juega con Gote y saca al rey de la línea de ataque.',
    create: () =>
      position('gote', [
        [5, 1, g('king')],
        [5, 5, s('rook')],
        [5, 9, s('king')],
      ]),
  },
  {
    id: 'checkmate',
    title: 'Un jaque mate',
    description:
      'El rey rojo está atrapado en la esquina: el oro da jaque y todas sus casillas de escape están controladas.',
    create: () =>
      position('gote', [
        [9, 1, g('king')],
        [7, 2, s('rook')],
        [8, 3, s('gold')],
        [9, 2, s('gold')],
        [1, 9, s('king')],
      ]),
  },
  {
    id: 'atama-kin',
    title: 'Tsume en 1: oro en la cabeza',
    description:
      'Da jaque mate en una jugada. Pista: coloca una pieza de tu mano justo delante del rey, protegida por tu peón.',
    goal: 'mate',
    create: () =>
      position(
        'sente',
        [
          [5, 1, g('king')],
          [5, 3, s('pawn')],
          [5, 9, s('king')],
        ],
        { gold: 1 },
      ),
  },
  {
    id: 'uchifuzume',
    title: 'Uchifuzume: el peón prohibido',
    description:
      'Prueba a colocar el peón en 9二: sería mate, y eso está prohibido. Encuentra el mate con la otra pieza de tu mano.',
    goal: 'mate',
    create: () =>
      position(
        'sente',
        [
          [9, 1, g('king')],
          [9, 3, s('gold')],
          [7, 2, s('silver')],
          [1, 9, s('king')],
        ],
        { pawn: 1, gold: 1 },
      ),
  },
  {
    id: 'promotion',
    title: 'La zona de promoción',
    description:
      'Las tres últimas filas son la zona de promoción. Lleva la plata o la torre hasta allí y decide si promocionar.',
    create: () =>
      position('sente', [
        [5, 1, g('king')],
        [3, 4, s('silver')],
        [8, 5, s('rook')],
        [5, 9, s('king')],
      ]),
  },
  {
    id: 'nifu',
    title: 'Nifu: dos peones en una columna',
    description:
      'Tienes un peón en la mano. Intenta colocarlo en la columna 5, donde ya hay otro peón tuyo, y luego en otra columna.',
    create: () =>
      position(
        'sente',
        [
          [5, 1, g('king')],
          [5, 7, s('pawn')],
          [5, 9, s('king')],
        ],
        { pawn: 1 },
      ),
  },
]
