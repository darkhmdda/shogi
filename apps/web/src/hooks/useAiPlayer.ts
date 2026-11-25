import { useCallback, useEffect, useRef } from 'react'
import { chooseMove, type Difficulty } from '../engine/ai'
import type { AiRequest, AiResponse } from '../engine/ai.worker'
import type { Move, Position } from '../engine/types'

/**
 * Calcula jugadas de la máquina en un Web Worker para no bloquear la interfaz.
 * Si el navegador no admite workers, calcula en el hilo principal.
 */
export function useAiPlayer() {
  const workerRef = useRef<Worker | null>(null)
  const requestId = useRef(0)
  const pending = useRef<((move: Move | null) => void) | null>(null)

  useEffect(() => {
    if (typeof Worker === 'undefined') return

    const worker = new Worker(new URL('../engine/ai.worker.ts', import.meta.url), {
      type: 'module',
    })

    worker.onmessage = (event: MessageEvent<AiResponse>) => {
      if (event.data.id !== requestId.current) return
      const resolve = pending.current
      pending.current = null
      resolve?.(event.data.move)
    }

    workerRef.current = worker
    return () => {
      worker.terminate()
      workerRef.current = null
    }
  }, [])

  const cancel = useCallback(() => {
    requestId.current++
    pending.current = null
  }, [])

  const requestMove = useCallback(
    (position: Position, difficulty: Difficulty, onMove: (move: Move | null) => void) => {
      const id = ++requestId.current
      const worker = workerRef.current

      if (!worker) {
        const timer = window.setTimeout(() => {
          if (id === requestId.current) onMove(chooseMove(position, difficulty))
        }, 0)
        return () => window.clearTimeout(timer)
      }

      pending.current = onMove
      const request: AiRequest = { id, position, difficulty }
      worker.postMessage(request)
      return cancel
    },
    [cancel],
  )

  return { requestMove, cancel }
}
