/** Progreso de aprendizaje, mismo formato en web, móvil y backend. */
export type Progress = {
  lessons: Record<string, string>
  puzzles: Record<string, string>
  games: { played: number; won: number; lost: number; drawn: number }
}

export type Account = { username: string; token: string }

export type GameResultReason =
  | 'checkmate'
  | 'no-moves'
  | 'repetition'
  | 'perpetual-check'
  | 'resignation'
  | 'impasse'

export type GameUpload = {
  sfen: string
  moves: string[]
  winner: 'sente' | 'gote' | null
  reason: GameResultReason | null
  mode: 'ai' | 'local'
  difficulty: 'easy' | 'normal' | 'hard' | null
  human_side: 'sente' | 'gote' | null
}

export type SavedGame = GameUpload & { id: number; created_at: string }

export type GameStats = { total: number; won: number; lost: number; drawn: number }

export type OnlineState = {
  code: string
  sfen: string
  moves: string[]
  status: 'waiting' | 'active' | 'finished'
  sente: string | null
  gote: string | null
  winner: 'sente' | 'gote' | null
  reason: GameResultReason | null
  your_side: 'sente' | 'gote' | null
}

/**
 * Juego en línea, igual con cualquier servidor (API FastAPI o Supabase).
 * subscribe avisa de cada cambio de la partida y del estado de la conexión
 * en tiempo real; devuelve una función para dejar de escuchar.
 */
export type OnlineProvider = {
  create(side?: 'sente' | 'gote' | 'random'): Promise<OnlineState>
  list(): Promise<OnlineState[]>
  get(code: string): Promise<OnlineState>
  join(code: string): Promise<OnlineState>
  move(code: string, move: string, ply: number): Promise<OnlineState>
  resign(code: string): Promise<OnlineState>
  subscribe(code: string, onChange: (state: OnlineState) => void, onConnection: (live: boolean) => void): () => void
}

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

type Fetch = (input: string, init?: RequestInit) => Promise<Response>

export type ApiClientOptions = {
  baseUrl: string
  /** Token de la sesión actual, si la hay. */
  getToken: () => string | null
  /** Se llama cuando el servidor rechaza el token (sesión caducada o revocada). */
  onUnauthorized?: () => void
  fetch?: Fetch
}

export function createApiClient({ baseUrl, getToken, onUnauthorized, fetch: fetchImpl }: ApiClientOptions) {
  const root = baseUrl.replace(/\/$/, '')
  const doFetch: Fetch = fetchImpl ?? ((input, init) => fetch(input, init))

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    const token = getToken()
    if (token) headers.Authorization = `Bearer ${token}`

    let response: Response
    try {
      response = await doFetch(`${root}${path}`, { ...init, headers })
    } catch {
      throw new ApiError(0, 'No se pudo conectar con el servidor.')
    }

    if (response.status === 401 && token) onUnauthorized?.()

    if (!response.ok) {
      let detail = `Error ${response.status}`
      try {
        const body = (await response.json()) as { detail?: unknown }
        if (typeof body.detail === 'string') detail = body.detail
        else if (Array.isArray(body.detail)) {
          detail = 'Revisa los datos: usuario de 3 a 32 caracteres (letras, números, . _ -) y contraseña de al menos 8.'
        }
      } catch {
        // Respuesta sin JSON.
      }
      throw new ApiError(response.status, detail)
    }

    return response.status === 204 ? (undefined as T) : ((await response.json()) as T)
  }

  const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) })

  return {
    register: (username: string, password: string) =>
      request<Account>('/auth/register', json('POST', { username, password })),
    login: (username: string, password: string) =>
      request<Account>('/auth/login', json('POST', { username, password })),
    logout: () => request<void>('/auth/logout', { method: 'POST' }),
    changePassword: (currentPassword: string, newPassword: string) =>
      request<Account>('/auth/password', json('POST', { current_password: currentPassword, new_password: newPassword })),
    deleteAccount: (password: string) => request<void>('/auth/delete', json('POST', { password })),
    me: () => request<{ id: number; username: string; created_at: string }>('/auth/me'),
    getProgress: () => request<Progress>('/progress'),
    /** Envía el progreso local; el servidor devuelve la fusión con lo que ya tenía. */
    mergeProgress: (progress: Progress) => request<Progress>('/progress', json('PUT', progress)),
    saveGame: (game: GameUpload) => request<SavedGame>('/games', json('POST', game)),
    listGames: (limit = 10) => request<SavedGame[]>(`/games?limit=${limit}`),
    gameStats: () => request<GameStats>('/games/stats'),
    deleteGame: (id: number) => request<void>(`/games/${id}`, { method: 'DELETE' }),

    online: {
      create: (side: 'sente' | 'gote' | 'random' = 'random') => request<OnlineState>('/online', json('POST', { side })),
      list: () => request<OnlineState[]>('/online'),
      get: (code: string) => request<OnlineState>(`/online/${encodeURIComponent(code)}`),
      join: (code: string) => request<OnlineState>(`/online/${encodeURIComponent(code)}/join`, { method: 'POST' }),
      move: (code: string, move: string, ply: number) =>
        request<OnlineState>(`/online/${encodeURIComponent(code)}/move`, json('POST', { move, ply })),
      resign: (code: string) => request<OnlineState>(`/online/${encodeURIComponent(code)}/resign`, { method: 'POST' }),
      /** URL del WebSocket que envía el estado de la partida cada vez que cambia. */
      socketUrl: (code: string) => {
        const token = getToken() ?? ''
        return `${root.replace(/^http/, 'ws')}/online/${encodeURIComponent(code)}/ws?token=${encodeURIComponent(token)}`
      },
      /** Cambios en tiempo real por WebSocket. */
      subscribe(code: string, onChange: (state: OnlineState) => void, onConnection: (live: boolean) => void) {
        let socket: WebSocket | null = null
        try {
          socket = new WebSocket(this.socketUrl(code))
        } catch {
          onConnection(false)
          return () => {}
        }
        socket.onopen = () => onConnection(true)
        socket.onclose = () => onConnection(false)
        socket.onmessage = (event) => onChange(JSON.parse(String(event.data)) as OnlineState)
        // Mantiene viva la conexión a través de proxies.
        const ping = setInterval(() => socket?.readyState === WebSocket.OPEN && socket.send('ping'), 30_000)
        return () => {
          clearInterval(ping)
          if (socket) {
            socket.onclose = null
            socket.close()
          }
        }
      },
    } satisfies OnlineProvider & { socketUrl(code: string): string },
  }
}

export type ApiClient = ReturnType<typeof createApiClient>

/** Normaliza el progreso que devuelve el servidor (ignora campos extra como updated_at). */
export function pickProgress(progress: Progress): Progress {
  return {
    lessons: { ...progress.lessons },
    puzzles: { ...progress.puzzles },
    games: { ...progress.games },
  }
}

/** Huella para saber si el progreso ha cambiado desde la última sincronización. */
export function progressFingerprint(progress: Progress): string {
  const sorted = (record: Record<string, string>) =>
    Object.keys(record)
      .sort()
      .map((key) => `${key}=${record[key]}`)
      .join(',')
  const { played, won, lost, drawn } = progress.games
  return `${sorted(progress.lessons)}|${sorted(progress.puzzles)}|${played},${won},${lost},${drawn}`
}
