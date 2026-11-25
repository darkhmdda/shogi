import { search, type Difficulty, type SearchInfo } from './ai'
import type { Position } from './types'

export type AiRequest = { id: number; position: Position; difficulty: Difficulty }
export type AiResponse = { id: number; info: SearchInfo }

type WorkerScope = {
  onmessage: ((event: MessageEvent<AiRequest>) => void) | null
  postMessage: (message: AiResponse) => void
}

const scope = self as unknown as WorkerScope

scope.onmessage = (event) => {
  const { id, position, difficulty } = event.data
  scope.postMessage({ id, info: search(position, difficulty) })
}
