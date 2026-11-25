import { createClient, type SupabaseClient, type SupportedStorage } from '@supabase/supabase-js'
import { ApiError, type GameUpload, type OnlineProvider, type OnlineState, type Progress, type SavedGame } from './index'

/** Cuenta con Supabase: se entra con correo; el nombre de usuario es el público. */
export type SupabaseAccount = { username: string; email: string }

export type SignUpResult = { account: SupabaseAccount | null; needsConfirmation: boolean }

type ProgressRow = {
  lessons: Record<string, string>
  puzzles: Record<string, string>
  games_played: number
  games_won: number
  games_lost: number
  games_drawn: number
}

type GameRow = {
  id: number
  start_sfen: string
  moves: string[]
  winner: SavedGame['winner']
  reason: SavedGame['reason']
  mode: SavedGame['mode']
  difficulty: SavedGame['difficulty']
  human_side: SavedGame['human_side']
  created_at: string
}

export type SupabaseBackendOptions = {
  url: string
  /** Clave pública (publishable/anon). Nunca la clave secreta. */
  key: string
  /** Almacenamiento de la sesión (AsyncStorage en React Native; por defecto, localStorage). */
  storage?: SupportedStorage
  /** Dirección a la que vuelve el enlace de confirmación del correo. */
  redirectTo?: string
}

type OnlineRow = {
  code: string
  sente_id: string | null
  gote_id: string | null
  sente_name: string | null
  gote_name: string | null
  start_sfen: string
  moves: string[]
  status: OnlineState['status']
  winner: OnlineState['winner']
  reason: OnlineState['reason']
}

const USERNAME = /^[a-z0-9_.-]{3,32}$/

/** Mensaje de error que devuelve la Edge Function, si lo hay. */
async function functionErrorMessage(error: unknown): Promise<string> {
  const context = (error as { context?: unknown }).context
  if (context instanceof Response) {
    try {
      const body = (await context.clone().json()) as { error?: string }
      if (body.error) return body.error
    } catch {
      // Sin cuerpo JSON.
    }
    if (context.status === 404) return 'El servidor de partidas en línea no está instalado (función "online-move").'
  }
  return translateAuthError((error as Error).message ?? 'No se pudo enviar la jugada.')
}

/** Traduce los errores más habituales de Supabase al español. */
export function translateAuthError(message: string): string {
  const text = message.toLowerCase()
  if (text.includes('invalid login credentials')) return 'Correo o contraseña incorrectos.'
  if (text.includes('email not confirmed')) return 'Todavía no has confirmado tu correo: revisa tu bandeja de entrada.'
  if (text.includes('already registered') || text.includes('already been registered'))
    return 'Ya existe una cuenta con ese correo.'
  if (text.includes('password should be at least') || text.includes('weak password'))
    return 'La contraseña es demasiado débil: usa al menos 8 caracteres.'
  if (text.includes('rate limit') || text.includes('too many'))
    return 'Demasiados intentos. Espera unos minutos y vuelve a probar.'
  if (text.includes('unable to validate email') || text.includes('invalid email'))
    return 'El correo no es válido.'
  if (text.includes('failed to fetch') || text.includes('fetch failed') || text.includes('network'))
    return 'No se pudo conectar con el servidor.'
  return message
}

function fail(error: { message: string; status?: number } | null): never {
  throw new ApiError(error?.status ?? 0, translateAuthError(error?.message ?? 'Error desconocido.'))
}

export function createSupabaseBackend({ url, key, storage, redirectTo }: SupabaseBackendOptions) {
  const supabase: SupabaseClient = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: typeof window !== 'undefined' && storage === undefined,
      ...(storage ? { storage } : {}),
    },
  })

  async function profileFor(userId: string, email: string): Promise<SupabaseAccount> {
    const { data, error } = await supabase.from('profiles').select('username').eq('id', userId).single()
    if (error) fail(error)
    return { username: data.username as string, email }
  }

  async function verifyPassword(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new ApiError(403, 'La contraseña actual no es correcta.')
  }

  return {
    supabase,

    /** Sesión guardada en el dispositivo, si la hay. */
    async currentAccount(): Promise<SupabaseAccount | null> {
      const { data } = await supabase.auth.getSession()
      const user = data.session?.user
      if (!user) return null
      try {
        return await profileFor(user.id, user.email ?? '')
      } catch {
        return null
      }
    },

    /** Avisa cuando se inicia o se cierra la sesión (también desde otra pestaña o al confirmar el correo). */
    onAuthChange(callback: (account: SupabaseAccount | null) => void): () => void {
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        const user = session?.user
        if (!user) {
          callback(null)
          return
        }
        // Fuera del callback: Supabase no permite llamadas a la API dentro de él.
        setTimeout(() => {
          profileFor(user.id, user.email ?? '').then(callback, () => callback(null))
        }, 0)
      })
      return () => data.subscription.unsubscribe()
    },

    async signUp(email: string, password: string, username: string): Promise<SignUpResult> {
      const name = username.trim().toLowerCase()
      if (!USERNAME.test(name)) {
        throw new ApiError(422, 'El nombre de usuario debe tener de 3 a 32 caracteres: letras, números, punto, guion o guion bajo.')
      }
      const { data: free, error: checkError } = await supabase.rpc('username_available', { name })
      if (checkError) fail(checkError)
      if (!free) throw new ApiError(409, 'Ese nombre de usuario ya existe.')

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { username: name }, ...(redirectTo ? { emailRedirectTo: redirectTo } : {}) },
      })
      if (error) fail(error)
      // Si el correo ya tiene cuenta, Supabase no lo dice (por privacidad) pero
      // devuelve un usuario sin identidades: lo avisamos para no confundir.
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        throw new ApiError(409, 'Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña.')
      }
      if (!data.session || !data.user) return { account: null, needsConfirmation: true }
      return { account: await profileFor(data.user.id, data.user.email ?? email), needsConfirmation: false }
    },

    async signIn(email: string, password: string): Promise<SupabaseAccount> {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) fail(error)
      return profileFor(data.user.id, data.user.email ?? email)
    },

    async signOut() {
      await supabase.auth.signOut()
    },

    /** Envía un correo con un enlace para elegir una contraseña nueva. */
    async requestPasswordReset(email: string) {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), redirectTo ? { redirectTo } : undefined)
      if (error) fail(error)
    },

    /** Vuelve a enviar el correo de confirmación de la cuenta. */
    async resendConfirmation(email: string) {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
        ...(redirectTo ? { options: { emailRedirectTo: redirectTo } } : {}),
      })
      if (error) fail(error)
    },

    /** Avisa cuando se vuelve a la app desde el enlace de "recuperar contraseña". */
    onPasswordRecovery(callback: () => void): () => void {
      const { data } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY') callback()
      })
      return () => data.subscription.unsubscribe()
    },

    /** Fija una contraseña nueva (tras entrar con el enlace de recuperación). */
    async setNewPassword(password: string) {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) fail(error)
    },

    /** Juego en línea: tabla online_games + Realtime + Edge Function "online-move". */
    online: ((): OnlineProvider => {
      async function toState(row: OnlineRow): Promise<OnlineState> {
        const { data } = await supabase.auth.getSession()
        const uid = data.session?.user.id
        return {
          code: row.code,
          sfen: row.start_sfen,
          moves: row.moves ?? [],
          status: row.status,
          sente: row.sente_name,
          gote: row.gote_name,
          winner: row.winner,
          reason: row.reason,
          your_side: uid && uid === row.sente_id ? 'sente' : uid && uid === row.gote_id ? 'gote' : null,
        }
      }

      async function rpc(name: string, args: Record<string, unknown>): Promise<OnlineState> {
        const { data, error } = await supabase.rpc(name, args)
        if (error) fail(error)
        return toState(data as OnlineRow)
      }

      return {
        create: (side = 'random') => rpc('create_online_game', { side }),
        join: (code) => rpc('join_online_game', { game_code: code }),
        resign: (code) => rpc('resign_online_game', { game_code: code }),

        async list() {
          const { data, error } = await supabase
            .from('online_games')
            .select('*')
            .order('updated_at', { ascending: false })
            .limit(20)
          if (error) fail(error)
          return Promise.all((data as OnlineRow[]).map(toState))
        },

        async get(code) {
          const { data, error } = await supabase
            .from('online_games')
            .select('*')
            .eq('code', code.trim().toUpperCase())
            .maybeSingle()
          if (error) fail(error)
          if (!data) throw new ApiError(404, 'Partida no encontrada.')
          return toState(data as OnlineRow)
        },

        async move(code, move, ply) {
          const { data, error } = await supabase.functions.invoke('online-move', { body: { code, move, ply } })
          if (error) throw new ApiError(409, await functionErrorMessage(error))
          return toState(data as OnlineRow)
        },

        subscribe(code, onChange, onConnection) {
          const channel = supabase
            .channel(`online-${code}-${Math.random().toString(36).slice(2)}`)
            .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'online_games', filter: `code=eq.${code.trim().toUpperCase()}` },
              (payload) => {
                if (payload.new && 'code' in payload.new) toState(payload.new as OnlineRow).then(onChange)
              },
            )
            .subscribe((status) => onConnection(status === 'SUBSCRIBED'))
          return () => {
            supabase.removeChannel(channel)
          }
        },
      }
    })(),

    async mergeProgress(progress: Progress): Promise<Progress> {
      const { data, error } = await supabase.rpc('merge_progress', { incoming: progress })
      if (error) fail(error)
      const row = data as ProgressRow
      return {
        lessons: row.lessons ?? {},
        puzzles: row.puzzles ?? {},
        games: { played: row.games_played, won: row.games_won, lost: row.games_lost, drawn: row.games_drawn },
      }
    },

    async saveGame(game: GameUpload): Promise<void> {
      const { error } = await supabase.from('games').insert({
        start_sfen: game.sfen,
        moves: game.moves,
        winner: game.winner,
        reason: game.reason,
        mode: game.mode,
        difficulty: game.difficulty,
        human_side: game.human_side,
      })
      if (error) fail(error)
    },

    async listGames(limit = 10): Promise<SavedGame[]> {
      const { data, error } = await supabase
        .from('games')
        .select('id, start_sfen, moves, winner, reason, mode, difficulty, human_side, created_at')
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) fail(error)
      return (data as GameRow[]).map((row) => ({
        id: row.id,
        sfen: row.start_sfen,
        moves: row.moves,
        winner: row.winner,
        reason: row.reason,
        mode: row.mode,
        difficulty: row.difficulty,
        human_side: row.human_side,
        created_at: row.created_at,
      }))
    },

    /** Cambia la contraseña tras comprobar la actual; cierra las demás sesiones. */
    async changePassword(email: string, current: string, next: string) {
      await verifyPassword(email, current)
      const { error } = await supabase.auth.updateUser({ password: next })
      if (error) fail(error)
      await supabase.auth.signOut({ scope: 'others' })
    },

    /** Borra la cuenta y todos sus datos del servidor (tras comprobar la contraseña). */
    async deleteAccount(email: string, password: string) {
      await verifyPassword(email, password)
      const { error } = await supabase.rpc('delete_my_account')
      if (error) fail(error)
      await supabase.auth.signOut({ scope: 'local' })
    },
  }
}

export type SupabaseBackend = ReturnType<typeof createSupabaseBackend>
