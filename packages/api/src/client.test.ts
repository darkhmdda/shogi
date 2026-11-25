import { describe, expect, it, vi } from 'vitest'
import { ApiError, createApiClient, progressFingerprint } from './index'

function mockFetch(status: number, body: unknown) {
  return vi.fn(async () => new Response(status === 204 ? null : JSON.stringify(body), { status }))
}

describe('cliente de la API', () => {
  it('envía el token y el cuerpo JSON', async () => {
    const fetch = mockFetch(200, { lessons: {}, puzzles: {}, games: { played: 1, won: 1, lost: 0, drawn: 0 } })
    const client = createApiClient({ baseUrl: 'http://api/', getToken: () => 'abc', fetch })
    await client.mergeProgress({ lessons: { a: '1' }, puzzles: {}, games: { played: 1, won: 1, lost: 0, drawn: 0 } })

    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('http://api/progress')
    expect(init.method).toBe('PUT')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer abc')
    expect(JSON.parse(init.body as string).lessons).toEqual({ a: '1' })
  })

  it('convierte los errores del servidor en ApiError', async () => {
    const client = createApiClient({ baseUrl: 'http://api', getToken: () => null, fetch: mockFetch(409, { detail: 'Ese nombre de usuario ya existe.' }) })
    await expect(client.register('kei', 'contraseña')).rejects.toEqual(new ApiError(409, 'Ese nombre de usuario ya existe.'))
  })

  it('avisa cuando la sesión deja de ser válida', async () => {
    const onUnauthorized = vi.fn()
    const client = createApiClient({ baseUrl: 'http://api', getToken: () => 'viejo', onUnauthorized, fetch: mockFetch(401, { detail: 'Sesión no válida.' }) })
    await expect(client.getProgress()).rejects.toBeInstanceOf(ApiError)
    expect(onUnauthorized).toHaveBeenCalled()
  })

  it('informa de fallos de red', async () => {
    const client = createApiClient({
      baseUrl: 'http://api',
      getToken: () => null,
      fetch: async () => {
        throw new TypeError('offline')
      },
    })
    await expect(client.listGames()).rejects.toMatchObject({ status: 0 })
  })

  it('construye la URL del WebSocket con el token', () => {
    const client = createApiClient({ baseUrl: 'https://api.ejemplo.com', getToken: () => 'a b', fetch: mockFetch(200, {}) })
    expect(client.online.socketUrl('abc123')).toBe('wss://api.ejemplo.com/online/abc123/ws?token=a%20b')
  })

  it('la huella no depende del orden de las claves', () => {
    const games = { played: 0, won: 0, lost: 0, drawn: 0 }
    expect(progressFingerprint({ lessons: { a: '1', b: '2' }, puzzles: {}, games })).toBe(
      progressFingerprint({ lessons: { b: '2', a: '1' }, puzzles: {}, games }),
    )
  })
})
