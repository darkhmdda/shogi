import './Training.css'
import { useRef, useState } from 'react'
import { defenderReply, solveMate } from '@shogi/engine'
import { formatMove } from '@shogi/engine'
import { applyMove, generateLegalMoves, isInCheck } from '@shogi/engine'
import { TSUME, tsumePosition, type Tsume } from '@shogi/engine'
import type { Move, Position } from '@shogi/engine'
import { useMoveInput } from '@shogi/react'
import { completePuzzle, useProgress } from '../progress'
import BoardView, { PromotionChoice } from './BoardView'

type Status = 'playing' | 'waiting' | 'solved' | 'failed'

type PuzzleState = {
  id: string
  position: Position
  played: number
  lastMove?: Move
  status: Status
  moves: string[]
}

function start(tsume: Tsume): PuzzleState {
  return { id: tsume.id, position: tsumePosition(tsume), played: 0, status: 'playing', moves: [] }
}

export default function Puzzles() {
  const progress = useProgress()
  const [state, setState] = useState<PuzzleState>(() => start(TSUME.find((t) => !progress.puzzles[t.id]) ?? TSUME[0]))
  const [message, setMessage] = useState<string | null>(null)
  const [solution, setSolution] = useState<string | null>(null)
  const [showHint, setShowHint] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  const tsume = TSUME.find((t) => t.id === state.id)!
  const index = TSUME.indexOf(tsume)
  const solvedCount = TSUME.filter((t) => progress.puzzles[t.id]).length

  const input = useMoveInput(state.position, {
    enabled: state.status === 'playing',
    onMove: handleMove,
    onMessage: setMessage,
  })

  function handleMove(move: Move) {
    const before = state.position
    const after = applyMove(before, move)

    if (!isInCheck(after.board, after.turn)) {
      setMessage('En los problemas de tsume cada jugada tuya debe dar jaque. Prueba otra.')
      return
    }

    const moves = [...state.moves, formatMove(before, move, state.lastMove?.to ?? null)]
    const played = state.played + 1

    if (generateLegalMoves(after).length === 0) {
      setState({ ...state, position: after, played, lastMove: move, status: 'solved', moves })
      setMessage('¡Jaque mate! Problema resuelto.')
      completePuzzle(tsume.id)
      return
    }

    if (played >= tsume.plies) {
      setState({ ...state, position: after, played, lastMove: move, status: 'failed', moves })
      setMessage('Es jaque, pero no mate, y ya no quedan jugadas. Inténtalo de nuevo.')
      return
    }

    const waiting = { ...state, position: after, played, lastMove: move, status: 'waiting' as Status, moves }
    setState(waiting)
    setMessage('Jaque. El defensor responde…')

    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      const reply = defenderReply(after, tsume.plies - played - 1)
      if (!reply) return
      const position = applyMove(after, reply)
      const replyText = formatMove(after, reply, move.to)
      const canStillMate = solveMate(position, tsume.plies - played - 1) !== null
      setState({
        ...waiting,
        position,
        played: played + 1,
        lastMove: reply,
        status: 'playing',
        moves: [...moves, replyText],
      })
      const left = Math.ceil((tsume.plies - played - 1) / 2)
      setMessage(
        canStillMate
          ? `El defensor juega ${replyText}. ${left === 1 ? 'Te queda una jugada' : `Te quedan ${left} jugadas`} para dar mate.`
          : `El defensor juega ${replyText} y ya no hay mate posible. Pulsa "Reintentar".`,
      )
    }, 450)
  }

  function open(target: Tsume) {
    window.clearTimeout(timer.current)
    setState(start(target))
    setMessage(null)
    setSolution(null)
    setShowHint(false)
  }

  function revealSolution() {
    const initial = tsumePosition(tsume)
    const line = solveMate(initial, tsume.plies)
    if (!line) return
    let position = initial
    const texts: string[] = []
    let previous: Move | null = null
    for (const move of line) {
      texts.push(formatMove(position, move, previous?.to ?? null))
      position = applyMove(position, move)
      previous = move
    }
    setSolution(texts.join(' '))
  }

  const groups: { label: string; items: Tsume[] }[] = [
    { label: 'Mate en 1 (1手詰)', items: TSUME.filter((t) => t.plies === 1) },
    { label: 'Mate en 3 (3手詰)', items: TSUME.filter((t) => t.plies === 3) },
    { label: 'Mate en 5 (5手詰)', items: TSUME.filter((t) => t.plies === 5) },
  ]

  return (
    <div className="training">
      <nav className="training-list" aria-label="Problemas de mate">
        <p className="training-progress">
          {solvedCount} de {TSUME.length} problemas resueltos
          <span className="progress-bar" aria-hidden="true">
            <span style={{ width: `${(solvedCount / TSUME.length) * 100}%` }} />
          </span>
        </p>
        {groups.map((group) => (
          <div key={group.label} className="training-group">
            <h4>{group.label}</h4>
            <div className="training-chips">
              {group.items.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={`training-chip${item.id === tsume.id ? ' active' : ''}${progress.puzzles[item.id] ? ' done' : ''}`}
                  onClick={() => open(item)}
                  title={item.title}
                  aria-label={`${item.title}${progress.puzzles[item.id] ? ', resuelto' : ''}`}
                >
                  {TSUME.indexOf(item) + 1}
                </button>
              ))}
            </div>
          </div>
        ))}
        <p className="muted training-rules">
          Reglas del tsume: juegas con Sente y cada jugada debe ser jaque. El defensor tiene en la mano todas las
          piezas que no están en el tablero y siempre elige la mejor defensa.
        </p>
      </nav>

      <div className="training-board">
        <BoardView
          position={state.position}
          selection={input.selection}
          targets={input.targets}
          pending={input.pending}
          lastMove={state.lastMove}
          canUseHand={(owner) => owner === 'sente' && state.status === 'playing'}
          handLabel={(owner) => (owner === 'sente' ? 'Tu mano' : 'Defensor')}
          hideHand="gote"
          onSquare={input.selectSquare}
          onHand={input.selectHand}
        />
      </div>

      <aside className="training-panel shogi-panel-section" aria-live="polite">
        <span className="training-step">
          Problema {index + 1} · mate en {tsume.plies}
        </span>
        <h3>{tsume.title}</h3>
        <p className="training-instruction">
          Da jaque mate en{' '}
          {tsume.plies === 1
            ? 'una jugada'
            : tsume.plies === 3
              ? 'tres jugadas (tú, el defensor, tú)'
              : 'cinco jugadas: tres tuyas y dos del defensor'}
          .
        </p>

        {input.pending && (
          <PromotionChoice position={state.position} pending={input.pending} onChoose={input.choosePromotion} />
        )}

        {message && (
          <p className={`training-feedback${state.status === 'solved' ? ' success' : state.status === 'failed' ? ' error' : ''}`}>
            {message}
          </p>
        )}
        {state.moves.length > 0 && <p className="training-moves">{state.moves.join(' ')}</p>}
        {showHint && <p className="training-hint">💡 {tsume.hint}</p>}
        {solution && <p className="training-hint">Solución: {solution}</p>}

        <div className="shogi-buttons">
          {state.status === 'solved' && index < TSUME.length - 1 && (
            <button type="button" onClick={() => open(TSUME[index + 1])}>
              Siguiente problema
            </button>
          )}
          <button type="button" onClick={() => open(tsume)}>
            Reintentar
          </button>
          <button type="button" onClick={() => setShowHint(true)} disabled={showHint}>
            Pista
          </button>
          <button type="button" onClick={revealSolution} disabled={solution !== null}>
            Ver solución
          </button>
        </div>
      </aside>
    </div>
  )
}
