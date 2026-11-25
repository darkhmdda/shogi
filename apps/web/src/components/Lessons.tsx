import './Training.css'
import { useState } from 'react'
import { describeMove } from '../engine/explain'
import { LESSONS, goalSatisfied, type Lesson } from '../engine/lessons'
import { fromSfen } from '../engine/record'
import { applyMove } from '../engine/rules'
import type { Move, Position } from '../engine/types'
import { useMoveInput } from '../hooks/useMoveInput'
import { completeLesson, useProgress } from '../progress'
import BoardView, { PromotionChoice } from './BoardView'

type StepState = {
  lessonId: string
  step: number
  position: Position
  lastMove?: Move
  done: boolean
}

function startStep(lesson: Lesson, step: number): StepState {
  return { lessonId: lesson.id, step, position: fromSfen(lesson.steps[step].sfen), done: false }
}

export default function Lessons() {
  const progress = useProgress()
  const [state, setState] = useState<StepState>(() => {
    const next = LESSONS.find((lesson) => !progress.lessons[lesson.id]) ?? LESSONS[0]
    return startStep(next, 0)
  })
  const [message, setMessage] = useState<string | null>(null)
  const [showHint, setShowHint] = useState(false)

  const lesson = LESSONS.find((entry) => entry.id === state.lessonId)!
  const step = lesson.steps[state.step]
  const isLastStep = state.step === lesson.steps.length - 1
  const lessonIndex = LESSONS.indexOf(lesson)
  const completed = LESSONS.filter((entry) => progress.lessons[entry.id]).length

  const input = useMoveInput(state.position, {
    enabled: !state.done,
    onMove: handleMove,
    onMessage: setMessage,
  })

  function handleMove(move: Move) {
    if (!goalSatisfied(step.goal, state.position, move)) {
      setMessage(`Es un movimiento legal, pero no es el objetivo de este paso. ${step.hint}`)
      return
    }

    const before = state.position
    setState({ ...state, position: applyMove(before, move), lastMove: move, done: true })
    setMessage(`${step.success} (${describeMove(before, move)})`)
    if (isLastStep) completeLesson(lesson.id)
  }

  function goTo(target: Lesson, stepIndex = 0) {
    setState(startStep(target, stepIndex))
    setMessage(null)
    setShowHint(false)
  }

  function next() {
    if (!isLastStep) goTo(lesson, state.step + 1)
    else if (lessonIndex < LESSONS.length - 1) goTo(LESSONS[lessonIndex + 1])
  }

  return (
    <div className="training">
      <nav className="training-list" aria-label="Lecciones">
        <p className="training-progress">
          {completed} de {LESSONS.length} lecciones completadas
          <span className="progress-bar" aria-hidden="true">
            <span style={{ width: `${(completed / LESSONS.length) * 100}%` }} />
          </span>
        </p>
        {LESSONS.map((entry, index) => (
          <button
            type="button"
            key={entry.id}
            className={`training-item${entry.id === lesson.id ? ' active' : ''}`}
            onClick={() => goTo(entry)}
            aria-current={entry.id === lesson.id ? 'step' : undefined}
          >
            <span className="training-kanji" aria-hidden="true">{entry.kanji}</span>
            <span>
              <strong>
                {index + 1}. {entry.title}
              </strong>
              <small>{entry.summary}</small>
            </span>
            {progress.lessons[entry.id] && <span className="training-done" aria-label="completada">✓</span>}
          </button>
        ))}
      </nav>

      <div className="training-board">
        <BoardView
          position={state.position}
          selection={input.selection}
          targets={input.targets}
          pending={input.pending}
          lastMove={state.lastMove}
          canUseHand={(owner) => owner === state.position.turn && !state.done}
          onSquare={input.selectSquare}
          onHand={input.selectHand}
        />
      </div>

      <aside className="training-panel shogi-panel-section" aria-live="polite">
        <span className="training-step">
          Lección {lessonIndex + 1} · paso {state.step + 1} de {lesson.steps.length}
        </span>
        <h3>{lesson.title}</h3>
        <p className="training-instruction">{step.instruction}</p>

        {input.pending && (
          <PromotionChoice position={state.position} pending={input.pending} onChoose={input.choosePromotion} />
        )}

        {message && <p className={`training-feedback${state.done ? ' success' : ''}`}>{message}</p>}
        {showHint && !state.done && <p className="training-hint">💡 {step.hint}</p>}

        <div className="shogi-buttons">
          {state.done ? (
            (!isLastStep || lessonIndex < LESSONS.length - 1) && (
              <button type="button" onClick={next}>
                {isLastStep ? 'Siguiente lección' : 'Siguiente paso'}
              </button>
            )
          ) : (
            <button type="button" onClick={() => setShowHint(true)} disabled={showHint}>
              Pista
            </button>
          )}
          <button type="button" onClick={() => goTo(lesson, state.step)}>
            Repetir paso
          </button>
        </div>

        {state.done && isLastStep && lessonIndex === LESSONS.length - 1 && (
          <p className="training-feedback success">
            ¡Has completado todas las lecciones! Prueba ahora los problemas de mate o una partida contra la máquina.
          </p>
        )}
      </aside>
    </div>
  )
}
