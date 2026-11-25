import type { ApiClient, OnlineState } from '@shogi/api'
import { deserializeGame, toUsi, type GameState, type Move } from '@shogi/engine'
import { useEffect, useMemo, useState } from 'react'

/**
 * Sigue una partida en línea: recibe el estado por WebSocket (con consulta
 * periódica como respaldo) y envía las jugadas al servidor, que las valida.
 */
export function useOnlineGame(client: ApiClient | null, code: string | null) {
  const [state, setState] = useState<OnlineState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!code || !client) return

    let active = true
    let socket: WebSocket | null = null
    let poll: ReturnType<typeof setInterval> | undefined

    // El WebSocket no conoce el lado del jugador: se conserva el de la API REST.
    const update = (next: OnlineState) => {
      if (!active) return
      setState((previous) => ({ ...next, your_side: next.your_side ?? previous?.your_side ?? null }))
    }

    const startPolling = () => {
      clearInterval(poll)
      poll = setInterval(() => {
        client.online.get(code).then(update).catch(() => {})
      }, 3000)
    }

    client.online
      .get(code)
      .then(update)
      .catch((reason: Error) => active && setError(reason.message))

    try {
      socket = new WebSocket(client.online.socketUrl(code))
      socket.onopen = () => {
        if (!active) return
        setConnected(true)
        clearInterval(poll)
      }
      socket.onmessage = (event) => update(JSON.parse(String(event.data)) as OnlineState)
      socket.onclose = () => {
        if (!active) return
        setConnected(false)
        startPolling()
      }
    } catch {
      startPolling()
    }

    // Mantiene viva la conexión a través de proxies.
    const ping = setInterval(() => socket?.readyState === WebSocket.OPEN && socket.send('ping'), 30_000)

    return () => {
      active = false
      clearInterval(poll)
      clearInterval(ping)
      socket?.close()
      setState(null)
      setError(null)
      setConnected(false)
    }
  }, [client, code])

  const game = useMemo<GameState | null>(() => {
    if (!state) return null
    try {
      return deserializeGame({ sfen: state.sfen, moves: state.moves })
    } catch {
      return null
    }
  }, [state])

  async function sendMove(move: Move) {
    if (!client || !state || !code) return
    setSending(true)
    setError(null)
    try {
      const next = await client.online.move(code, toUsi(move), state.moves.length)
      setState(next)
    } catch (reason) {
      setError((reason as Error).message)
      client.online.get(code).then(setState).catch(() => {})
    } finally {
      setSending(false)
    }
  }

  async function resign() {
    if (!client || !code) return
    try {
      setState(await client.online.resign(code))
    } catch (reason) {
      setError((reason as Error).message)
    }
  }

  return { state, game, error, sending, connected, sendMove, resign }
}
