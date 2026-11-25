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
    let poll: ReturnType<typeof setInterval> | undefined

    // Los avisos en tiempo real pueden no traer el lado del jugador: se conserva el ya conocido.
    const update = (next: OnlineState) => {
      if (!active) return
      setState((previous) => ({ ...next, your_side: next.your_side ?? previous?.your_side ?? null }))
    }

    const startPolling = () => {
      clearInterval(poll)
      poll = setInterval(() => {
        online.get(code).then(update).catch(() => {})
      }, 3000)
    }

    online
      .get(code)
      .then(update)
      .catch((reason: Error) => active && setError(reason.message))

    const unsubscribe = online.subscribe(code, update, (live) => {
      if (!active) return
      setConnected(live)
      if (live) {
        clearInterval(poll)
        // Por si hubo cambios mientras no había conexión.
        online.get(code).then(update).catch(() => {})
      } else {
        startPolling()
      }
    })

    return () => {
      active = false
      clearInterval(poll)
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
