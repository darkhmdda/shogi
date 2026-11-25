import { describe, expect, it } from 'vitest'
import {
  applyMove,
  createInitialPosition,
  emptyBoard,
  emptyHands,
  generateLegalMoves,
  isInCheck,
  legalDrops,
  legalMovesFrom,
  promotionOptions,
} from './rules'
import { newGame, playMove, undo } from './game'
import { chooseMove } from './ai'
import { explainIllegalBoardMove, explainIllegalDrop } from './explain'
import { formatMove, toUsi } from './notation'
import { PRACTICE_POSITIONS } from './positions'
import type { Move, Piece, Position, Square } from './types'

/** Casilla a partir de notación de shōgi (columna 1-9, fila 1-9). */
const sq = (file: number, rank: number): Square => ({ row: rank - 1, col: 9 - file })

function practice(id: string): Position {
  const entry = PRACTICE_POSITIONS.find((p) => p.id === id)
  if (!entry) throw new Error(`No existe la posición ${id}`)
  return entry.create()
}

function custom(turn: 'sente' | 'gote', pieces: [number, number, Piece][]): Position {
  const board = emptyBoard()
  for (const [file, rank, piece] of pieces) board[rank - 1][9 - file] = piece
  return { board, hands: emptyHands(), turn }
}

/** Perft: número de posiciones alcanzables tras `depth` jugadas. */
function perft(position: Position, depth: number): number {
  if (depth === 0) return 1
  let total = 0
  for (const move of generateLegalMoves(position)) {
    total += perft(applyMove(position, move), depth - 1)
  }
  return total
}

describe('posición inicial', () => {
  it('tiene 30 jugadas legales para Sente', () => {
    expect(generateLegalMoves(createInitialPosition())).toHaveLength(30)
  })

  it('coincide con los valores conocidos de perft', () => {
    const start = createInitialPosition()
    expect(perft(start, 1)).toBe(30)
    expect(perft(start, 2)).toBe(900)
    expect(perft(start, 3)).toBe(25470)
  })
})

describe('movimientos de piezas', () => {
  it('el caballo solo salta hacia delante', () => {
    const position = custom('sente', [
      [5, 5, { kind: 'knight', owner: 'sente' }],
      [1, 9, { kind: 'king', owner: 'sente' }],
      [9, 1, { kind: 'king', owner: 'gote' }],
    ])
    const targets = legalMovesFrom(position, sq(5, 5)).map((m) => m.to)
    expect(targets).toEqual(expect.arrayContaining([sq(6, 3), sq(4, 3)]))
    // Cada destino aparece dos veces: con y sin promoción.
    expect(new Set(targets.map((t) => `${t.row}-${t.col}`)).size).toBe(2)
  })

  it('el dragón añade un paso en diagonal a la torre', () => {
    const position = custom('sente', [
      [5, 5, { kind: 'rook', owner: 'sente', promoted: true }],
      [1, 9, { kind: 'king', owner: 'sente' }],
      [9, 1, { kind: 'king', owner: 'gote' }],
    ])
    const targets = legalMovesFrom(position, sq(5, 5)).map((m) => m.to)
    expect(targets).toContainEqual(sq(4, 4))
    expect(targets).not.toContainEqual(sq(3, 3))
    expect(targets).toContainEqual(sq(5, 1))
  })

  it('las piezas de rango no saltan', () => {
    const start = createInitialPosition()
    expect(legalMovesFrom(start, sq(8, 8))).toHaveLength(0)
  })

  it('una pieza clavada no puede moverse fuera de la línea', () => {
    const position = custom('sente', [
      [5, 9, { kind: 'king', owner: 'sente' }],
      [5, 7, { kind: 'gold', owner: 'sente' }],
      [5, 1, { kind: 'lance', owner: 'gote' }],
      [1, 1, { kind: 'king', owner: 'gote' }],
    ])
    const targets = legalMovesFrom(position, sq(5, 7)).map((m) => m.to)
    expect(targets).toEqual(expect.arrayContaining([sq(5, 6), sq(5, 8)]))
    expect(targets).toHaveLength(2)
    expect(explainIllegalBoardMove(position, sq(5, 7), sq(4, 7))).toMatch(/clavad/)
  })
})

describe('promoción', () => {
  it('es opcional al entrar en la zona', () => {
    const pawn: Piece = { kind: 'pawn', owner: 'sente' }
    expect(promotionOptions(pawn, sq(5, 4), sq(5, 3))).toEqual({ canPromote: true, mustPromote: false })
  })

  it('es obligatoria si la pieza quedaría sin movimientos', () => {
    const pawn: Piece = { kind: 'pawn', owner: 'sente' }
    const knight: Piece = { kind: 'knight', owner: 'gote' }
    expect(promotionOptions(pawn, sq(5, 2), sq(5, 1)).mustPromote).toBe(true)
    expect(promotionOptions(knight, sq(5, 6), sq(4, 8)).mustPromote).toBe(true)
  })

  it('también se puede promocionar al salir de la zona', () => {
    const silver: Piece = { kind: 'silver', owner: 'sente' }
    expect(promotionOptions(silver, sq(5, 3), sq(4, 4)).canPromote).toBe(true)
  })

  it('el oro y el rey no promocionan', () => {
    expect(promotionOptions({ kind: 'gold', owner: 'sente' }, sq(5, 4), sq(5, 3)).canPromote).toBe(false)
  })
})

describe('colocaciones desde la mano', () => {
  it('impide el nifu', () => {
    const position = practice('nifu')
    const drops = legalDrops(position, 'pawn')
    expect(drops.some((s) => s.col === sq(5, 1).col)).toBe(false)
    expect(drops.length).toBeGreaterThan(0)
    expect(explainIllegalDrop(position, 'pawn', sq(5, 5))).toMatch(/Nifu/)
  })

  it('impide colocar piezas que no podrían moverse', () => {
    const position = custom('sente', [
      [5, 9, { kind: 'king', owner: 'sente' }],
      [1, 5, { kind: 'king', owner: 'gote' }],
    ])
    position.hands.sente.knight = 1
    position.hands.sente.lance = 1
    expect(legalDrops(position, 'knight').every((s) => s.row >= 2)).toBe(true)
    expect(legalDrops(position, 'lance').every((s) => s.row >= 1)).toBe(true)
  })

  it('prohíbe el uchifuzume pero permite el mate con oro', () => {
    const position = practice('uchifuzume')
    expect(legalDrops(position, 'pawn')).not.toContainEqual(sq(9, 2))
    expect(explainIllegalDrop(position, 'pawn', sq(9, 2))).toMatch(/Uchifuzume/)

    let game = newGame(position)
    game = playMove(game, { type: 'drop', piece: 'gold', to: sq(9, 2) })
    expect(game.result).toEqual({ winner: 'sente', reason: 'checkmate' })
  })

  it('permite un jaque de peón colocado que no es mate', () => {
    const position = custom('sente', [
      [5, 9, { kind: 'king', owner: 'sente' }],
      [5, 1, { kind: 'king', owner: 'gote' }],
    ])
    position.hands.sente.pawn = 1
    expect(legalDrops(position, 'pawn')).toContainEqual(sq(5, 2))
  })
})

describe('final de partida', () => {
  it('detecta el jaque mate', () => {
    const game = newGame(practice('checkmate'))
    expect(game.result).toEqual({ winner: 'sente', reason: 'checkmate' })
  })

  it('el tsume de oro en la cabeza se resuelve', () => {
    const game = playMove(newGame(practice('atama-kin')), {
      type: 'drop',
      piece: 'gold',
      to: sq(5, 2),
    })
    expect(game.result?.reason).toBe('checkmate')
  })

  it('detecta jaque', () => {
    expect(isInCheck(practice('check').board, 'gote')).toBe(true)
  })

  it('declara tablas por repetición (sennichite)', () => {
    let game = newGame()
    const shuffle: Move[] = [
      { type: 'move', from: sq(2, 8), to: sq(3, 8), promote: false },
      { type: 'move', from: sq(8, 2), to: sq(7, 2), promote: false },
      { type: 'move', from: sq(3, 8), to: sq(2, 8), promote: false },
      { type: 'move', from: sq(7, 2), to: sq(8, 2), promote: false },
    ]

    for (let i = 0; i < 3; i++) {
      for (const move of shuffle) game = playMove(game, move)
    }

    expect(game.result).toEqual({ winner: null, reason: 'repetition' })
  })

  it('el jaque perpetuo pierde', () => {
    let game = newGame(
      custom('sente', [
        [9, 1, { kind: 'king', owner: 'gote' }],
        [8, 5, { kind: 'rook', owner: 'sente' }],
        [1, 9, { kind: 'king', owner: 'sente' }],
      ]),
    )

    // Cada jugada de Sente es jaque: la torre alterna entre las columnas 9 y 8.
    const cycle: Move[] = [
      { type: 'move', from: sq(8, 5), to: sq(9, 5), promote: false },
      { type: 'move', from: sq(9, 1), to: sq(8, 1), promote: false },
      { type: 'move', from: sq(9, 5), to: sq(8, 5), promote: false },
      { type: 'move', from: sq(8, 1), to: sq(9, 1), promote: false },
    ]

    for (let i = 0; i < 3; i++) {
      for (const move of cycle) game = playMove(game, move)
    }

    expect(game.result).toEqual({ winner: 'gote', reason: 'perpetual-check' })
  })
})

describe('historial', () => {
  it('deshace jugadas', () => {
    let game = newGame()
    game = playMove(game, { type: 'move', from: sq(7, 7), to: sq(7, 6), promote: false })
    game = playMove(game, { type: 'move', from: sq(3, 3), to: sq(3, 4), promote: false })
    game = undo(game, 2)
    expect(game.history).toHaveLength(0)
    expect(game.position).toEqual(createInitialPosition())
  })

  it('rechaza jugadas ilegales', () => {
    expect(() =>
      playMove(newGame(), { type: 'move', from: sq(7, 7), to: sq(7, 5), promote: false }),
    ).toThrow()
  })
})

describe('notación', () => {
  it('formatea en kifu y USI', () => {
    const start = createInitialPosition()
    const move: Move = { type: 'move', from: sq(7, 7), to: sq(7, 6), promote: false }
    expect(formatMove(start, move)).toBe('▲7六歩')
    expect(toUsi(move)).toBe('7g7f')
    expect(toUsi({ type: 'drop', piece: 'pawn', to: sq(5, 5) })).toBe('P*5e')
  })
})

describe('inteligencia artificial', () => {
  it('encuentra el mate en una', () => {
    for (const difficulty of ['normal', 'hard'] as const) {
      const position = practice('atama-kin')
      const move = chooseMove(position, difficulty)
      expect(move).not.toBeNull()
      const game = playMove(newGame(position), move!)
      expect(game.result?.reason).toBe('checkmate')
    }
  })

  it('captura una pieza gratis', () => {
    const position = custom('sente', [
      [5, 9, { kind: 'king', owner: 'sente' }],
      [5, 5, { kind: 'rook', owner: 'sente' }],
      [5, 3, { kind: 'bishop', owner: 'gote' }],
      [1, 1, { kind: 'king', owner: 'gote' }],
    ])
    const move = chooseMove(position, 'normal')
    expect(move?.to).toEqual(sq(5, 3))
  })

  it('siempre devuelve una jugada legal desde la posición inicial', () => {
    const start = createInitialPosition()
    const move = chooseMove(start, 'easy')
    expect(generateLegalMoves(start)).toContainEqual(move)
  })
})
