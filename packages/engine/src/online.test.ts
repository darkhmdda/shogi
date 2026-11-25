import { describe, expect, it } from 'vitest'
import { validateOnlineMove, type OnlineGameRecord } from './online'
import { INITIAL_SFEN } from './record'

const game = (moves: string[] = [], extra: Partial<OnlineGameRecord> = {}): OnlineGameRecord => ({
  sente_id: 'ana',
  gote_id: 'ben',
  start_sfen: INITIAL_SFEN,
  moves,
  status: 'active',
  ...extra,
})

describe('validación de jugadas en línea', () => {
  it('acepta una jugada legal en su turno', () => {
    expect(validateOnlineMove(game(), 'ana', '7g7f', 0)).toEqual({
      ok: true,
      moves: ['7g7f'],
      status: 'active',
      winner: null,
      reason: null,
    })
  })

  it('rechaza jugadas ilegales, mal escritas o fuera de turno', () => {
    expect(validateOnlineMove(game(), 'ana', '7g7e', 0)).toMatchObject({ ok: false, status: 422 })
    expect(validateOnlineMove(game(), 'ana', 'hola', 0)).toMatchObject({ ok: false, status: 422 })
    expect(validateOnlineMove(game(), 'ben', '3c3d', 0)).toMatchObject({ ok: false, error: 'No es tu turno.' })
    expect(validateOnlineMove(game(), 'carla', '7g7f', 0)).toMatchObject({ ok: false, status: 403 })
  })

  it('rechaza jugadas desfasadas y partidas no activas', () => {
    expect(validateOnlineMove(game(['7g7f']), 'ben', '3c3d', 0)).toMatchObject({ ok: false, status: 409 })
    expect(validateOnlineMove(game([], { status: 'waiting', gote_id: null }), 'ana', '7g7f', 0)).toMatchObject({ ok: false })
    expect(validateOnlineMove(game([], { status: 'finished' }), 'ana', '7g7f', 0)).toMatchObject({ ok: false })
  })

  it('detecta el jaque mate y termina la partida', () => {
    const mate = game([], { start_sfen: '4k4/9/4P4/9/9/9/9/9/4K4 b G 1' })
    expect(validateOnlineMove(mate, 'ana', 'G*5b', 0)).toMatchObject({
      ok: true,
      status: 'finished',
      winner: 'sente',
      reason: 'checkmate',
    })
  })

  it('prohíbe el uchifuzume también en línea', () => {
    const position = game([], { start_sfen: 'k8/2S6/G8/9/9/9/9/9/8K b GP 1' })
    expect(validateOnlineMove(position, 'ana', 'P*9b', 0)).toMatchObject({ ok: false, status: 422 })
  })
})
