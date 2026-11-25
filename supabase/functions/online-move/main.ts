// Edge Function "online-move" (Deno). Ver supabase/README.md para instalarla.
// Este archivo y handler.ts son el código fuente; index.ts es el paquete
// generado (npm run build:function) que se pega en el panel de Supabase.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { handleOnlineMove, type OnlineGameRow } from './handler.ts'

declare const Deno: {
  env: { get(name: string): string | undefined }
  serve(handler: (request: Request) => Response | Promise<Response>): void
}

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
})

Deno.serve((request) =>
  handleOnlineMove(request, {
    async userFromToken(token) {
      const { data, error } = await admin.auth.getUser(token)
      return error || !data.user ? null : { id: data.user.id }
    },

    async findGame(code) {
      const { data } = await admin.from('online_games').select('*').eq('code', code).maybeSingle()
      return (data as OnlineGameRow | null) ?? null
    },

    async saveIfUnchanged(game, update) {
      const { data } = await admin
        .from('online_games')
        .update({ ...update, updated_at: new Date().toISOString() })
        .eq('id', game.id)
        .eq('status', 'active')
        .eq('moves', `{${game.moves.join(',')}}`)
        .select()
        .maybeSingle()
      return (data as OnlineGameRow | null) ?? null
    },
  }),
)
