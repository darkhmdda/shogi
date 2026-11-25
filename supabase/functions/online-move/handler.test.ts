import { describe, expect, it } from 'vitest'
import { handleOnlineMove, type Deps, type OnlineGameRow } from './handler'

const INITIAL = 'lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1'

function fakeDeps(rows: OnlineGameRow[]): Deps {
  const tokens: Record<string, string> = { 'token-ana': 'ana', 'token-ben': 'ben' }
  return {
    async userFromToken(token) {
      return tokens[token] ? { id: tokens[token] } : null
    },
    async findGame(code) {
      return rows.find((row) => row.code === code) ?? null
    },
    async saveIfUnchanged(game, update) {
      const row = rows.find((r) => r.id === game.id)!
      if (row.status !== 'active' || row.moves.join(',') !== game.moves.join(',')) return null
      Object.assign(row, update)
      return { ...row }
    },
  }
}

const row = (): OnlineGameRow => ({
  id: 1,
  code: 'ABC234',
  sente_id: 'ana',
  gote_id: 'ben',
  start_sfen: INITIAL,
  moves: [],
  status: 'active',
  winner: null,
  reason: null,
})

const post = (token: string | null, body: unknown) =>
  new Request('https://x/functions/v1/online-move', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })

describe('Edge Function online-move', () => {
  it('responde a la comprobación CORS del navegador', async () => {
    const response = await handleOnlineMove(new Request('https://x', { method: 'OPTIONS' }), fakeDeps([]))
    expect(response.status).toBe(200)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })

  it('exige sesión y datos completos', async () => {
    const deps = fakeDeps([row()])
    expect((await handleOnlineMove(post(null, { code: 'ABC234', move: '7g7f', ply: 0 }), deps)).status).toBe(401)
    expect((await handleOnlineMove(post('falso', { code: 'ABC234', move: '7g7f', ply: 0 }), deps)).status).toBe(401)
    expect((await handleOnlineMove(post('token-ana', 'no es json'), deps)).status).toBe(400)
    expect((await handleOnlineMove(post('token-ana', { code: 'ABC234' }), deps)).status).toBe(400)
    expect((await handleOnlineMove(post('token-ana', { code: 'ZZZ999', move: '7g7f', ply: 0 }), deps)).status).toBe(404)
  })

  it('guarda jugadas legales y rechaza las ilegales', async () => {
    const rows = [row()]
    const deps = fakeDeps(rows)
    const ok = await handleOnlineMove(post('token-ana', { code: 'abc234', move: '7g7f', ply: 0 }), deps)
    expect(ok.status).toBe(200)
    expect((await ok.json()).moves).toEqual(['7g7f'])

    const illegal = await handleOnlineMove(post('token-ben', { code: 'ABC234', move: '3c3e', ply: 1 }), deps)
    expect(illegal.status).toBe(422)
    const wrongTurn = await handleOnlineMove(post('token-ana', { code: 'ABC234', move: '2g2f', ply: 1 }), deps)
    expect(wrongTurn.status).toBe(409)
    expect(rows[0].moves).toEqual(['7g7f'])
  })

  it('no pisa una jugada que llegó antes (dos peticiones a la vez)', async () => {
    const rows = [row()]
    const deps = fakeDeps(rows)
    const stale = { ...rows[0], moves: [...rows[0].moves] }
    rows[0].moves = ['7g7f']
    const conflict = await handleOnlineMove(post('token-ana', { code: 'ABC234', move: '2g2f', ply: 0 }), {
      ...deps,
      findGame: async () => stale,
    })
    expect(conflict.status).toBe(409)
  })
})
