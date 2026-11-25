import type {
  Board,
  BoardMove,
  Hand,
  HandKind,
  Hands,
  Move,
  Owner,
  Piece,
  PieceKind,
  Position,
  Square,
} from './types'

export const BOARD_SIZE = 9

export const HAND_ORDER: HandKind[] = [
  'rook',
  'bishop',
  'gold',
  'silver',
  'knight',
  'lance',
  'pawn',
]

type Vector = readonly [number, number]

const ORTHOGONAL: Vector[] = [[-1, 0], [1, 0], [0, -1], [0, 1]]
const DIAGONAL: Vector[] = [[-1, -1], [-1, 1], [1, -1], [1, 1]]
const ALL_ADJACENT: Vector[] = [...ORTHOGONAL, ...DIAGONAL]

// Vectores desde el punto de vista de Sente (fila negativa = avanzar).
const GOLD_STEPS: Vector[] = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0]]
const SILVER_STEPS: Vector[] = [[-1, -1], [-1, 0], [-1, 1], [1, -1], [1, 1]]
const KNIGHT_STEPS: Vector[] = [[-2, -1], [-2, 1]]
const PAWN_STEPS: Vector[] = [[-1, 0]]
const LANCE_SLIDES: Vector[] = [[-1, 0]]

export type MovePattern = {
  steps: Vector[]
  slides: Vector[]
}

/** Patrón de movimiento de una pieza visto desde Sente. */
export function movePatternFor(kind: PieceKind, promoted = false): MovePattern {
  if (promoted) {
    switch (kind) {
      case 'rook':
        return { steps: DIAGONAL, slides: ORTHOGONAL }
      case 'bishop':
        return { steps: ORTHOGONAL, slides: DIAGONAL }
      case 'pawn':
      case 'lance':
      case 'knight':
      case 'silver':
        return { steps: GOLD_STEPS, slides: [] }
      default:
        break
    }
  }

  switch (kind) {
    case 'king':
      return { steps: ALL_ADJACENT, slides: [] }
    case 'rook':
      return { steps: [], slides: ORTHOGONAL }
    case 'bishop':
      return { steps: [], slides: DIAGONAL }
    case 'gold':
      return { steps: GOLD_STEPS, slides: [] }
    case 'silver':
      return { steps: SILVER_STEPS, slides: [] }
    case 'knight':
      return { steps: KNIGHT_STEPS, slides: [] }
    case 'lance':
      return { steps: [], slides: LANCE_SLIDES }
    case 'pawn':
      return { steps: PAWN_STEPS, slides: [] }
  }
}

export function otherOwner(owner: Owner): Owner {
  return owner === 'sente' ? 'gote' : 'sente'
}

export function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE
}

export function sameSquare(a: Square, b: Square): boolean {
  return a.row === b.row && a.col === b.col
}

export function emptyHand(): Hand {
  return { rook: 0, bishop: 0, gold: 0, silver: 0, knight: 0, lance: 0, pawn: 0 }
}

export function emptyHands(): Hands {
  return { sente: emptyHand(), gote: emptyHand() }
}

export function emptyBoard(): Board {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null))
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => [...row])
}

export function clonePosition(position: Position): Position {
  return {
    board: cloneBoard(position.board),
    hands: {
      sente: { ...position.hands.sente },
      gote: { ...position.hands.gote },
    },
    turn: position.turn,
  }
}

export function createInitialPosition(): Position {
  const board = emptyBoard()
  const backRow: PieceKind[] = [
    'lance', 'knight', 'silver', 'gold', 'king',
    'gold', 'silver', 'knight', 'lance',
  ]

  for (let col = 0; col < BOARD_SIZE; col++) {
    board[0][col] = { kind: backRow[col], owner: 'gote' }
    board[2][col] = { kind: 'pawn', owner: 'gote' }
    board[6][col] = { kind: 'pawn', owner: 'sente' }
    board[8][col] = { kind: backRow[col], owner: 'sente' }
  }

  // Gote: torre en 8二, alfil en 2二. Sente: alfil en 8八, torre en 2八.
  board[1][1] = { kind: 'rook', owner: 'gote' }
  board[1][7] = { kind: 'bishop', owner: 'gote' }
  board[7][1] = { kind: 'bishop', owner: 'sente' }
  board[7][7] = { kind: 'rook', owner: 'sente' }

  return { board, hands: emptyHands(), turn: 'sente' }
}

/** Casillas que una pieza situada en `from` ataca (sin importar jaques). */
export function attackedSquares(board: Board, from: Square): Square[] {
  const piece = board[from.row][from.col]
  if (!piece) return []

  const sign = piece.owner === 'sente' ? 1 : -1
  const pattern = movePatternFor(piece.kind, piece.promoted)
  const result: Square[] = []

  for (const [dr, dc] of pattern.steps) {
    const row = from.row + dr * sign
    const col = from.col + dc * sign
    if (inBounds(row, col)) result.push({ row, col })
  }

  for (const [dr, dc] of pattern.slides) {
    let row = from.row + dr * sign
    let col = from.col + dc * sign

    while (inBounds(row, col)) {
      result.push({ row, col })
      if (board[row][col] !== null) break
      row += dr * sign
      col += dc * sign
    }
  }

  return result
}

/** ¿Ataca `piece` desde una distancia `distance` en la dirección (dr, dc) hacia el objetivo? */
function attacksAlong(piece: Piece, dr: number, dc: number, distance: number): boolean {
  // (dr, dc) es la dirección desde la pieza hacia el objetivo, en coordenadas absolutas.
  const sign = piece.owner === 'sente' ? 1 : -1
  const pattern = movePatternFor(piece.kind, piece.promoted)

  if (distance === 1) {
    for (const [sr, sc] of pattern.steps) {
      if (sr * sign === dr && sc * sign === dc) return true
    }
  }

  for (const [sr, sc] of pattern.slides) {
    if (sr * sign === dr && sc * sign === dc) return true
  }

  return false
}

/**
 * Comprueba si `by` ataca la casilla `target` mirando hacia fuera desde ella:
 * es mucho más rápido que generar los ataques de todas las piezas.
 */
export function isSquareAttacked(board: Board, target: Square, by: Owner): boolean {
  for (const [dr, dc] of ALL_ADJACENT) {
    let row = target.row + dr
    let col = target.col + dc
    let distance = 1

    while (inBounds(row, col)) {
      const piece = board[row][col]

      if (piece) {
        if (piece.owner === by && attacksAlong(piece, -dr, -dc, distance)) return true
        break
      }

      row += dr
      col += dc
      distance++
    }
  }

  // Caballos: atacan desde dos filas "por detrás" del objetivo según su dueño.
  const knightRow = target.row + (by === 'sente' ? 2 : -2)
  for (const dc of [-1, 1]) {
    const col = target.col + dc
    if (!inBounds(knightRow, col)) continue
    const piece = board[knightRow][col]
    if (piece?.owner === by && piece.kind === 'knight' && !piece.promoted) return true
  }

  return false
}

export function findKing(board: Board, owner: Owner): Square | null {
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const piece = board[row][col]
      if (piece?.kind === 'king' && piece.owner === owner) return { row, col }
    }
  }

  return null
}

export function isInCheck(board: Board, owner: Owner): boolean {
  const king = findKing(board, owner)
  // Sin rey (posiciones de práctica incompletas) no hay jaque posible.
  if (!king) return false
  return isSquareAttacked(board, king, otherOwner(owner))
}

export function canPromote(piece: Piece): boolean {
  return !piece.promoted && piece.kind !== 'king' && piece.kind !== 'gold'
}

export function inPromotionZone(owner: Owner, row: number): boolean {
  return owner === 'sente' ? row <= 2 : row >= 6
}

/** Filas en las que una pieza sin promocionar ya no tendría movimientos. */
export function isDeadEndRow(kind: PieceKind, owner: Owner, row: number): boolean {
  const distance = owner === 'sente' ? row : BOARD_SIZE - 1 - row

  if (kind === 'pawn' || kind === 'lance') return distance === 0
  if (kind === 'knight') return distance <= 1
  return false
}

export function promotionOptions(piece: Piece, from: Square, to: Square): {
  canPromote: boolean
  mustPromote: boolean
} {
  const possible =
    canPromote(piece) &&
    (inPromotionZone(piece.owner, from.row) || inPromotionZone(piece.owner, to.row))

  const forced = possible && isDeadEndRow(piece.kind, piece.owner, to.row)

  return { canPromote: possible, mustPromote: forced }
}

export function hasUnpromotedPawnOnFile(board: Board, owner: Owner, col: number): boolean {
  for (let row = 0; row < BOARD_SIZE; row++) {
    const piece = board[row][col]
    if (piece?.owner === owner && piece.kind === 'pawn' && !piece.promoted) return true
  }

  return false
}

/** Aplica un movimiento sin comprobar su legalidad. */
export function applyMove(position: Position, move: Move): Position {
  const next = clonePosition(position)
  const owner = position.turn

  if (move.type === 'drop') {
    next.board[move.to.row][move.to.col] = { kind: move.piece, owner }
    next.hands[owner][move.piece] -= 1
  } else {
    const piece = next.board[move.from.row][move.from.col]
    if (!piece) throw new Error('No hay pieza en la casilla de origen.')

    const captured = next.board[move.to.row][move.to.col]
    if (captured && captured.kind !== 'king') {
      next.hands[owner][captured.kind as HandKind] += 1
    }

    next.board[move.from.row][move.from.col] = null
    next.board[move.to.row][move.to.col] = move.promote
      ? { ...piece, promoted: true }
      : piece
  }

  next.turn = otherOwner(owner)
  return next
}

/** Movimientos de tablero que respetan el patrón de la pieza (pueden dejar al rey en jaque). */
function pseudoBoardMoves(position: Position, from: Square): BoardMove[] {
  const piece = position.board[from.row][from.col]
  if (!piece || piece.owner !== position.turn) return []

  const moves: BoardMove[] = []

  for (const to of attackedSquares(position.board, from)) {
    const target = position.board[to.row][to.col]
    if (target?.owner === piece.owner) continue

    const { canPromote: may, mustPromote: must } = promotionOptions(piece, from, to)

    if (may) moves.push({ type: 'move', from, to, promote: true })
    if (!must) moves.push({ type: 'move', from, to, promote: false })
  }

  return moves
}

/**
 * Comprueba si el movimiento deja al propio rey a salvo. Modifica el tablero
 * temporalmente y lo restaura antes de volver (evita copiar la posición).
 */
function leavesKingSafe(position: Position, move: Move): boolean {
  const board = position.board
  const owner = position.turn
  const to = board[move.to.row][move.to.col]

  if (move.type === 'drop') {
    board[move.to.row][move.to.col] = { kind: move.piece, owner }
    const safe = !isInCheck(board, owner)
    board[move.to.row][move.to.col] = to
    return safe
  }

  const from = board[move.from.row][move.from.col]
  board[move.to.row][move.to.col] = from
  board[move.from.row][move.from.col] = null
  const safe = !isInCheck(board, owner)
  board[move.from.row][move.from.col] = from
  board[move.to.row][move.to.col] = to
  return safe
}

export function legalMovesFrom(position: Position, from: Square): BoardMove[] {
  return pseudoBoardMoves(position, from).filter((move) => leavesKingSafe(position, move))
}

export type DropRestriction =
  | 'occupied'
  | 'dead-end'
  | 'nifu'
  | 'no-piece'
  | null

export function dropRestriction(
  position: Position,
  kind: HandKind,
  to: Square,
): DropRestriction {
  const owner = position.turn
  if (position.hands[owner][kind] <= 0) return 'no-piece'
  if (position.board[to.row][to.col] !== null) return 'occupied'
  if (isDeadEndRow(kind, owner, to.row)) return 'dead-end'
  if (kind === 'pawn' && hasUnpromotedPawnOnFile(position.board, owner, to.col)) return 'nifu'
  return null
}

/**
 * Uchifuzume: está prohibido dar jaque mate colocando un peón desde la mano.
 *
 * Un jaque de peón colocado no se puede tapar (el peón está pegado al rey)
 * ni puede ser doble, así que basta con mirar si el rival tiene alguna
 * jugada de tablero (capturar el peón o huir con el rey).
 */
export function isPawnDropMate(position: Position, to: Square): boolean {
  const next = applyMove(position, { type: 'drop', piece: 'pawn', to })
  if (!isInCheck(next.board, next.turn)) return false

  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const piece = next.board[row][col]
      if (piece?.owner === next.turn && legalMovesFrom(next, { row, col }).length > 0) {
        return false
      }
    }
  }

  return true
}

function isLegalDrop(position: Position, kind: HandKind, to: Square, inCheck: boolean): boolean {
  if (dropRestriction(position, kind, to) !== null) return false

  const move: Move = { type: 'drop', piece: kind, to }

  // Colocar una pieza nunca expone al propio rey; solo importa si ya hay jaque.
  if (inCheck && !leavesKingSafe(position, move)) return false

  if (kind === 'pawn' && isPawnDropMate(position, to)) return false

  return true
}

export function legalDrops(position: Position, kind: HandKind): Square[] {
  const inCheck = isInCheck(position.board, position.turn)
  const squares: Square[] = []

  if (position.hands[position.turn][kind] <= 0) return squares

  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const to = { row, col }
      if (isLegalDrop(position, kind, to, inCheck)) squares.push(to)
    }
  }

  return squares
}

export function generateLegalMoves(position: Position): Move[] {
  const moves: Move[] = []

  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const piece = position.board[row][col]
      if (piece?.owner === position.turn) {
        moves.push(...legalMovesFrom(position, { row, col }))
      }
    }
  }

  for (const kind of HAND_ORDER) {
    for (const to of legalDrops(position, kind)) {
      moves.push({ type: 'drop', piece: kind, to })
    }
  }

  return moves
}

export function hasAnyLegalMove(position: Position): boolean {
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const piece = position.board[row][col]
      if (piece?.owner !== position.turn) continue
      if (legalMovesFrom(position, { row, col }).length > 0) return true
    }
  }

  const inCheck = isInCheck(position.board, position.turn)

  for (const kind of HAND_ORDER) {
    if (position.hands[position.turn][kind] <= 0) continue

    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        if (isLegalDrop(position, kind, { row, col }, inCheck)) return true
      }
    }
  }

  return false
}

export function isLegalMove(position: Position, move: Move): boolean {
  return generateLegalMoves(position).some((candidate) => movesEqual(candidate, move))
}

export function movesEqual(a: Move, b: Move): boolean {
  if (a.type !== b.type || !sameSquare(a.to, b.to)) return false
  if (a.type === 'drop' && b.type === 'drop') return a.piece === b.piece
  if (a.type === 'move' && b.type === 'move') {
    return sameSquare(a.from, b.from) && a.promote === b.promote
  }
  return false
}

/** Clave única de una posición para detectar repeticiones (sennichite). */
export function positionKey(position: Position): string {
  let key = ''

  for (const row of position.board) {
    for (const piece of row) {
      if (!piece) {
        key += '.'
      } else {
        const letter = PIECE_LETTERS[piece.kind]
        key += (piece.promoted ? '+' : '') +
          (piece.owner === 'sente' ? letter : letter.toLowerCase())
      }
    }
    key += '/'
  }

  for (const owner of ['sente', 'gote'] as const) {
    for (const kind of HAND_ORDER) key += position.hands[owner][kind]
    key += '|'
  }

  return key + position.turn
}

const PIECE_LETTERS: Record<PieceKind, string> = {
  king: 'K',
  rook: 'R',
  bishop: 'B',
  gold: 'G',
  silver: 'S',
  knight: 'N',
  lance: 'L',
  pawn: 'P',
}

export type ImpasseStatus = {
  /** Si se cumplen todas las condiciones para declarar y ganar. */
  canDeclare: boolean
  kingInZone: boolean
  piecesInZone: number
  points: number
  pointsNeeded: number
  inCheck: boolean
}

/**
 * Jishōgi / nyūgyoku: regla de declaración de 27 puntos (Federación Japonesa).
 * El bando al que le toca puede declarar y ganar si:
 * 1. su rey está en la zona rival (tres últimas filas),
 * 2. tiene al menos 10 piezas más en esa zona,
 * 3. suma 28 puntos (Sente) o 27 (Gote) entre las piezas de la zona y las de la mano
 *    (torre y alfil valen 5; el resto, 1; el rey no cuenta),
 * 4. su rey no está en jaque.
 */
export function impasseStatus(position: Position): ImpasseStatus {
  const owner = position.turn
  const king = findKing(position.board, owner)
  const kingInZone = king !== null && inPromotionZone(owner, king.row)
  let piecesInZone = 0
  let points = 0

  for (let row = 0; row < BOARD_SIZE; row++) {
    if (!inPromotionZone(owner, row)) continue
    for (let col = 0; col < BOARD_SIZE; col++) {
      const piece = position.board[row][col]
      if (!piece || piece.owner !== owner || piece.kind === 'king') continue
      piecesInZone++
      points += piece.kind === 'rook' || piece.kind === 'bishop' ? 5 : 1
    }
  }

  for (const kind of HAND_ORDER) {
    points += position.hands[owner][kind] * (kind === 'rook' || kind === 'bishop' ? 5 : 1)
  }

  const pointsNeeded = owner === 'sente' ? 28 : 27
  const inCheck = isInCheck(position.board, owner)

  return {
    canDeclare: kingInZone && piecesInZone >= 10 && points >= pointsNeeded && !inCheck,
    kingInZone,
    piecesInZone,
    points,
    pointsNeeded,
    inCheck,
  }
}
