import { validateOnlineMove, type OnlineGameRecord } from '../../../packages/engine/src/online.ts'

/** Fila de online_games tal como la devuelve la base de datos. */
export type OnlineGameRow = OnlineGameRecord & {
  id: number
  code: string
  winner: string | null
  reason: string | null
  [column: string]: unknown
}

/** Acceso a Supabase que necesita la función (se sustituye por un falso en los tests). */
export type Deps = {
  /** Usuario del token de sesión, o null si no es válido. */
  userFromToken(token: string): Promise<{ id: string } | null>
  findGame(code: string): Promise<OnlineGameRow | null>
  /**
   * Guarda el resultado solo si la partida no ha cambiado desde que se leyó
   * (mismas jugadas y sigue activa). Devuelve null si alguien se adelantó.
   */
  saveIfUnchanged(
    game: OnlineGameRow,
    update: { moves: string[]; status: string; winner: string | null; reason: string | null },
  ): Promise<OnlineGameRow | null>
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/**
 * Recibe { code, move, ply } de un jugador, valida la jugada con el motor de
 * reglas y la guarda. Los dos jugadores la reciben al momento por Realtime.
 */
export async function handleOnlineMove(request: Request, deps: Deps): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)

  const token = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  const user = token ? await deps.userFromToken(token) : null
  if (!user) return json({ error: 'Hay que iniciar sesión.' }, 401)

  let body: { code?: unknown; move?: unknown; ply?: unknown }
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Petición no válida.' }, 400)
  }
  const { code, move, ply } = body
  if (typeof code !== 'string' || typeof move !== 'string' || typeof ply !== 'number' || !Number.isInteger(ply)) {
    return json({ error: 'Faltan datos: code, move y ply.' }, 400)
  }

  const game = await deps.findGame(code.trim().toUpperCase())
  if (!game) return json({ error: 'Partida no encontrada.' }, 404)

  const outcome = validateOnlineMove(game, user.id, move, ply)
  if (!outcome.ok) return json({ error: outcome.error }, outcome.status)

  const saved = await deps.saveIfUnchanged(game, {
    moves: outcome.moves,
    status: outcome.status,
    winner: outcome.winner,
    reason: outcome.reason,
  })
  if (!saved) return json({ error: 'La partida ha cambiado: actualiza el tablero.' }, 409)
  return json(saved)
}
