import type { OnlineProvider, OnlineState } from '@shogi/api'
import { deserializeGame, toUsi, type GameState, type Move } from '@shogi/engine'
import { useEffect, useMemo, useState } from 'react'

/**
 * Sigue una partida en línea: recibe el estado en tiempo real (WebSocket o
 * Supabase Realtime, con consulta periódica como respaldo) y envía las jugadas
 * al servidor, que las valida.
 */
export function useOnlineGame(online: OnlineProvider | null, code: string | null) {
  const [state, setState] = useState<OnlineState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!code || !online) return

    let active = true
    let timer: ReturnType<typeof setInterval> | undefined

    // Los avisos en tiempo real pueden no traer el lado del jugador: se conserva el ya conocido.
    const update = (next: OnlineState) => {
      if (!active) return
      setState((previous) => ({ ...next, your_side: next.your_side ?? previous?.your_side ?? null }))
    }

    // Respaldo: aunque haya tiempo real, se consulta la partida de vez en
    // cuando (cada 10 s), y más a menudo (cada 3 s) si se pierde la conexión.
    // Así un aviso perdido nunca deja la partida atascada.
    const poll = (every: number) => {
      clearInterval(timer)
      timer = setInterval(() => {
        online.get(code).then(update).catch(() => {})
      }, every)
    }
    poll(3000)

    online
      .get(code)
      .then(update)
      .catch((reason: Error) => active && setError(reason.message))

    const unsubscribe = online.subscribe(code, update, (live) => {
      if (!active) return
      setConnected(live)
      poll(live ? 10_000 : 3000)
      // Por si hubo cambios mientras no había conexión.
      if (live) online.get(code).then(update).catch(() => {})
    })

    return () => {
      active = false
      clearInterval(timer)
      unsubscribe()
      setState(null)
      setError(null)
      setConnected(false)
    }
  }, [online, code])

  const game = useMemo<GameState | null>(() => {
    if (!state) return null
    try {
      return deserializeGame({ sfen: state.sfen, moves: state.moves })
    } catch {
      return null
    }
  }, [state])

  async function sendMove(move: Move) {
    if (!online || !state || !code) return
    setSending(true)
    setError(null)
    try {
      const next = await online.move(code, toUsi(move), state.moves.length)
      setState(next)
    } catch (reason) {
      setError((reason as Error).message)
      online.get(code).then(setState).catch(() => {})
    } finally {
      setSending(false)
    }
  }

  async function resign() {
    if (!online || !code) return
    try {
      setState(await online.resign(code))
    } catch (reason) {
      setError((reason as Error).message)
    }
  }

  return { state, game, error, sending, connected, sendMove, resign }
}
