export type PieceKind =
  | 'king'
  | 'rook'
  | 'bishop'
  | 'gold'
  | 'silver'
  | 'knight'
  | 'lance'
  | 'pawn'

/** Piezas que pueden estar en la mano (todas menos el rey). */
export type HandKind = Exclude<PieceKind, 'king'>

export type Owner = 'sente' | 'gote'

export type Piece = {
  kind: PieceKind
  owner: Owner
  promoted?: boolean
}

/**
 * Casilla del tablero en coordenadas de matriz.
 * row 0 = fila 一 (lado de Gote), col 0 = columna 9.
 */
export type Square = {
  row: number
  col: number
}

export type Board = (Piece | null)[][]

export type Hand = Record<HandKind, number>

export type Hands = Record<Owner, Hand>

export type Position = {
  board: Board
  hands: Hands
  turn: Owner
}

export type BoardMove = {
  type: 'move'
  from: Square
  to: Square
  promote: boolean
}

export type DropMove = {
  type: 'drop'
  piece: HandKind
  to: Square
}

export type Move = BoardMove | DropMove

export type GameResult = {
  winner: Owner | null
  reason:
    | 'checkmate'
    | 'no-moves'
    | 'repetition'
    | 'perpetual-check'
    | 'resignation'
    | 'impasse'
}
