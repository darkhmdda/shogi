import { describe, expect, it } from 'vitest'
import { OPENING_LINES, bookMoves, search } from './ai'
import { LESSONS, goalSatisfied } from './lessons'
import { solveMate } from './mate'
import { fromUsi } from './notation'
import { fromSfen, INITIAL_SFEN, toKif, toSfen, serializeGame, deserializeGame } from './record'
import { applyMove, createInitialPosition, generateLegalMoves, impasseStatus, movesEqual } from './rules'
import { newGame, playMove, declareImpasse } from './game'
import { TSUME, tsumePosition } from './tsume'

describe('problemas de tsume', () => {
  for (const tsume of TSUME) {
    it(`${tsume.id} tiene mate en ${tsume.plies}`, () => {
      const position = tsumePosition(tsume)
      const line = solveMate(position, tsume.plies)
      expect(line).not.toBeNull()
      expect(line!.length).toBe(tsume.plies)
      if (tsume.plies === 3) expect(solveMate(position, 1)).toBeNull()
    })
  }
})

describe('lecciones', () => {
  for (const lesson of LESSONS) {
    lesson.steps.forEach((step, index) => {
      it(`${lesson.id} paso ${index + 1} se puede completar`, () => {
        const position = fromSfen(step.sfen)
        const moves = generateLegalMoves(position)
        expect(moves.some((move) => goalSatisfied(step.goal, position, move))).toBe(true)
      })
    })
  }

  it('uchifuzume: el peón no cumple el objetivo, el oro sí', () => {
    const step = LESSONS.find((l) => l.id === 'special-rules')!.steps[1]
    const position = fromSfen(step.sfen)
    const legal = generateLegalMoves(position)
    expect(legal.some((m) => m.type === 'drop' && m.piece === 'pawn' && m.to.row === 1 && m.to.col === 0)).toBe(false)
  })
})

describe('SFEN y KIF', () => {
  it('la posición inicial ida y vuelta', () => {
    expect(toSfen(createInitialPosition())).toBe(INITIAL_SFEN)
    expect(fromSfen(INITIAL_SFEN)).toEqual(createInitialPosition())
  })

  it('manos y promociones', () => {
    const sfen = '8l/1r5+P1/p1+Bpkp3/6p1p/9/9/9/9/4K4 w 2Pb3g 40'
    expect(toSfen(fromSfen(sfen), 40)).toBe(sfen)
  })

  it('rechaza SFEN inválidos', () => {
    expect(() => fromSfen('9/9/9 b - 1')).toThrow()
    expect(() => fromSfen('lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNX b - 1')).toThrow()
  })

  it('guarda y recupera una partida', () => {
    let game = newGame()
    for (const usi of ['7g7f', '3c3d', '8h2b+', '3a2b', 'B*4e']) game = playMove(game, fromUsi(usi)!)
    const restored = deserializeGame(serializeGame(game))
    expect(restored.position).toEqual(game.position)
    expect(restored.history).toHaveLength(5)
  })

  it('exporta KIF', () => {
    let game = newGame()
    for (const usi of ['7g7f', '3c3d', '8h2b+', '3a2b']) game = playMove(game, fromUsi(usi)!)
    const kif = toKif(game)
    expect(kif).toContain('手合割：平手')
    expect(kif).toContain('   1 ７六歩(77)')
    expect(kif).toContain('   3 ２二角成(88)')
    expect(kif).toContain('   4 同　銀(31)')
  })
})

describe('impasse (jishōgi)', () => {
  it('cuenta puntos y permite declarar', () => {
    // Rey de Sente en 5二 con 10 piezas en la zona y suficientes puntos.
    const position = fromSfen('PPPPPPPPP/RB2K4/9/9/9/9/9/9/4k4 b RB2G 1')
    const status = impasseStatus(position)
    expect(status.kingInZone).toBe(true)
    expect(status.piecesInZone).toBe(11)
    expect(status.points).toBe(9 + 10 + 10 + 2)
    expect(status.canDeclare).toBe(true)
    expect(declareImpasse(newGame(position)).result).toEqual({ winner: 'sente', reason: 'impasse' })
  })

  it('no se puede sin el rey en la zona', () => {
    expect(impasseStatus(createInitialPosition()).canDeclare).toBe(false)
  })
})

describe('IA', () => {
  it('todas las líneas del libro son legales', () => {
    for (const line of OPENING_LINES) {
      let position = createInitialPosition()
      for (const text of line.split(' ')) {
        const move = fromUsi(text)!
        expect(generateLegalMoves(position).some((m) => movesEqual(m, move))).toBe(true)
        position = applyMove(position, move)
      }
    }
    expect(bookMoves(createInitialPosition()).length).toBeGreaterThan(1)
  })

  it('encuentra un mate en 3', () => {
    const tsume = TSUME.find((t) => t.id === 'm3-rook')!
    const info = search(tsumePosition(tsume), 'hard', Math.random, { timeMs: 5000, useBook: false })
    let game = newGame(tsumePosition(tsume))
    game = playMove(game, info.move!)
    expect(info.score).toBeGreaterThan(900_000)
  }, 20000)
})
