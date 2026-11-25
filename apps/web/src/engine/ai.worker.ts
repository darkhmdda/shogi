import { chooseMove, type Difficulty } from './ai'
import type { Move, Position } from './types'

export type AiRequest = { id: number; position: Position; difficulty: Difficulty }
export type AiResponse = { id: number; move: Move | null }

type WorkerScope = {
  onmessage: ((event: MessageEvent<AiRequest>) => void) | null
  postMessage: (message: AiResponse) => void
}

const scope = self as unknown as WorkerScope

scope.onmessage = (event) => {
  const { id, position, difficulty } = event.data
  scope.postMessage({ id, move: chooseMove(position, difficulty) })
}
