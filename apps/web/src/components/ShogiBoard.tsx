import './ShogiBoard.css'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { Difficulty } from '@shogi/engine'
import { describeMove } from '@shogi/engine'
import {
  declareImpasse,
  isCheck,
  newGame,
  playMove,
  resign,
  undo,
  type GameState,
} from '@shogi/engine'
import { formatMove } from '@shogi/engine'
import { JAPANESE_NAMES, OWNER_LABEL, OWNER_SHORT, PIECE_TIPS, pieceKanji, pieceName } from '@shogi/engine'
import { PRACTICE_POSITIONS, type PracticePosition } from '@shogi/engine'
import { deserializeGame, fromSfen, serializeGame, toKif, toSfen, type SavedGame } from '@shogi/engine'
import { impasseStatus, otherOwner } from '@shogi/engine'
import type { GameResult, Move, Owner } from '@shogi/engine'
import { useAiPlayer } from '../hooks/useAiPlayer'
import { useMoveInput } from '../hooks/useMoveInput'
import { recordGame, useProgress } from '../progress'
import { uploadGame } from '../api'
import BoardView, { PromotionChoice } from './BoardView'

type Mode = 'ai' | 'local'

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'Fácil',
  normal: 'Normal',
  hard: 'Difícil',
}

const STORAGE_KEY = 'shogi.game.v1'

type StoredSession = {
  game: SavedGame
  mode: Mode
  humanSide: Owner
  difficulty: Difficulty
  practiceId: string | null
}

function loadSession(): (StoredSession & { state: GameState }) | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const stored = JSON.parse(raw) as StoredSession
    return { ...stored, state: deserializeGame(stored.game) }
  } catch {
    return null
  }
}

function resultMessage(result: GameResult): string {
  const winner = result.winner ? OWNER_LABEL[result.winner] : ''
  const loser = result.winner ? OWNER_LABEL[otherOwner(result.winner)] : ''

  switch (result.reason) {
    case 'checkmate':
      return `¡Jaque mate! Gana ${winner}.`
    case 'no-moves':
      return `${loser} no tiene jugadas legales y pierde. Gana ${winner}.`
    case 'repetition':
      return 'Sennichite (千日手): la misma posición se ha repetido cuatro veces. La partida termina en tablas.'
    case 'perpetual-check':
      return `Jaque perpetuo: ${loser} repitió la posición dando jaque continuamente y pierde. Gana ${winner}.`
    case 'resignation':
      return `${loser} se rinde. Gana ${winner}.`
    case 'impasse':
      return `Impasse (入玉宣言): ${winner} declara con éxito y gana.`
  }
}

export default function ShogiBoard() {
  const [restored] = useState(loadSession)
  const [game, setGame] = useState<GameState>(() => restored?.state ?? newGame())
  const [mode, setMode] = useState<Mode>(restored?.mode ?? 'ai')
  const [humanSide, setHumanSide] = useState<Owner>(restored?.humanSide ?? 'sente')
  const [difficulty, setDifficulty] = useState<Difficulty>(restored?.difficulty ?? 'normal')
  const [practice, setPractice] = useState<PracticePosition | null>(
    () => PRACTICE_POSITIONS.find((p) => p.id === restored?.practiceId) ?? null,
  )
  const [showHints, setShowHints] = useState(true)
  const [message, setMessage] = useState(
    restored && restored.state.history.length > 0
      ? 'Partida recuperada: continúa donde la dejaste.'
      : 'Juegas con Sente (azul). Selecciona una pieza para ver sus movimientos posibles.',
  )
  const [hintMove, setHintMove] = useState<{ game: GameState; move: Move } | null>(null)
  const [hintLoading, setHintLoading] = useState(false)
  const [lastSearch, setLastSearch] = useState<string | null>(null)
  const [sfenInput, setSfenInput] = useState('')
  const { requestMove, cancel } = useAiPlayer()
  const progress = useProgress()

  const { position, result } = game
  const aiSide = otherOwner(humanSide)
  const aiActive = mode === 'ai' && practice === null
  const isHumanTurn = !aiActive || position.turn === humanSide
  const thinking = aiActive && !result && position.turn === aiSide
  const inCheck = isCheck(game)
  const flipped = aiActive && humanSide === 'gote'
  const lastMove = game.history.at(-1)?.move
  const impasse = useMemo(() => impasseStatus(position), [position])
  const hint = hintMove?.game === game ? hintMove.move : null

  const input = useMoveInput(position, {
    enabled: isHumanTurn && !result,
    onMove: (move) => commit(game, move, false),
    onMessage: setMessage,
  })

  const kifu = useMemo(
    () =>
      game.history.map((entry, index) => {
        const previous = index > 0 ? game.history[index - 1].move.to : null
        return formatMove(entry.before, entry.move, previous)
      }),
    [game.history],
  )

  // Guardado automático de la partida en el navegador.
  useEffect(() => {
    try {
      const session: StoredSession = {
        game: serializeGame(game),
        mode,
        humanSide,
        difficulty,
        practiceId: practice?.id ?? null,
      }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    } catch {
      // Sin almacenamiento disponible: no se guarda.
    }
  }, [game, mode, humanSide, difficulty, practice])

  function finish(next: GameState) {
    if (!next.result || !aiActive) return
    if (next.result.winner === null) recordGame('drawn')
    else recordGame(next.result.winner === humanSide ? 'won' : 'lost')

    // Si hay una cuenta iniciada, la partida se guarda en el servidor.
    const saved = serializeGame(next)
    uploadGame({
      sfen: saved.sfen,
      moves: saved.moves,
      winner: next.result.winner,
      reason: next.result.reason,
      mode: 'ai',
      difficulty,
      human_side: humanSide,
    }).catch(() => {
      // Sin conexión: la partida sigue disponible en este dispositivo.
    })
  }

  function commit(current: GameState, move: Move, byMachine: boolean) {
    const next = playMove(current, move)
    const notation = formatMove(current.position, move, current.history.at(-1)?.move.to ?? null)
    let text = `${byMachine ? 'La máquina juega' : 'Jugada'} ${notation}. ${describeMove(current.position, move)}`

    if (next.result) {
      text = resultMessage(next.result)
      if (practice?.goal === 'mate' && next.result.reason === 'checkmate') {
        text = `¡Ejercicio resuelto! ${text}`
      }
    } else if (practice?.goal === 'mate') {
      text += ' No es mate todavía: deshaz la jugada e inténtalo de nuevo.'
    }

    setGame(next)
    setMessage(text)
    finish(next)
  }

  // El efecto de la máquina usa siempre la versión más reciente de `commit`.
  const commitRef = useRef(commit)
  useEffect(() => {
    commitRef.current = commit
  })

  // Turno de la máquina.
  useEffect(() => {
    if (!aiActive || result || position.turn !== aiSide) return

    return requestMove(position, difficulty, (info) => {
      if (!info.move) return
      setLastSearch(
        info.fromBook
          ? 'Jugada de libro de aperturas.'
          : `Profundidad ${info.depth}, ${info.nodes.toLocaleString('es')} posiciones analizadas.`,
      )
      commitRef.current(game, info.move, true)
    })
  }, [game, position, result, aiActive, aiSide, difficulty, requestMove])

  function startGame(nextPractice: PracticePosition | null, note?: string, start?: GameState) {
    cancel()
    setHintLoading(false)
    setGame(start ?? newGame(nextPractice ? nextPractice.create() : undefined))
    setPractice(nextPractice)
    setLastSearch(null)
    setMessage(
      note ?? (nextPractice ? nextPractice.description : 'Nueva partida. Sente (azul) mueve primero.'),
    )
  }

  function handleUndo() {
    if (game.history.length === 0) return
    cancel()
    setHintLoading(false)
    const plies = aiActive && position.turn === humanSide && game.history.length >= 2 ? 2 : 1
    setGame(undo(game, plies))
    setMessage(plies === 2 ? 'Se han deshecho tu última jugada y la respuesta de la máquina.' : 'Jugada deshecha.')
  }

  function handleResign() {
    if (result) return
    cancel()
    const next = resign(game, aiActive ? humanSide : position.turn)
    setGame(next)
    setMessage(resultMessage(next.result!))
    finish(next)
  }

  function handleImpasse() {
    if (result || !impasse.canDeclare) return
    cancel()
    const next = declareImpasse(game)
    setGame(next)
    setMessage(resultMessage(next.result!))
    finish(next)
  }

  function handleHint() {
    if (result || !isHumanTurn || hintLoading) return
    setHintLoading(true)
    const forGame = game
    requestMove(position, 'hard', (info) => {
      setHintLoading(false)
      if (!info.move) return
      setHintMove({ game: forGame, move: info.move })
      const previous = forGame.history.at(-1)?.move.to ?? null
      setMessage(
        `Pista: la máquina jugaría ${formatMove(forGame.position, info.move, previous)}. ${describeMove(forGame.position, info.move)}`,
      )
    })
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') input.clear()
  }

  function downloadKif() {
    const sente = aiActive ? (humanSide === 'sente' ? 'Jugador' : 'Máquina') : 'Sente'
    const gote = aiActive ? (humanSide === 'gote' ? 'Jugador' : 'Máquina') : 'Gote'
    const blob = new Blob([toKif(game, sente, gote)], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `partida-shogi-${new Date().toISOString().slice(0, 10)}.kif`
    link.click()
    URL.revokeObjectURL(url)
  }

  async function copySfen() {
    const sfen = toSfen(position, game.history.length + 1)
    try {
      await navigator.clipboard.writeText(sfen)
      setMessage(`SFEN copiado: ${sfen}`)
    } catch {
      setSfenInput(sfen)
      setMessage('No se pudo copiar automáticamente; el SFEN está en el cuadro de texto.')
    }
  }

  function loadSfen() {
    try {
      const start = fromSfen(sfenInput)
      setMode('local')
      startGame(null, 'Posición SFEN cargada en modo dos jugadores.', newGame(start))
    } catch (error) {
      setMessage(`No se pudo leer el SFEN: ${(error as Error).message}`)
    }
  }

  const statusText = result
    ? resultMessage(result)
    : thinking
      ? 'La máquina está pensando…'
      : `Turno de ${OWNER_LABEL[position.turn]}${inCheck ? ' — ¡JAQUE!' : ''}`

  const selectedPiece =
    input.selection?.type === 'square'
      ? position.board[input.selection.square.row][input.selection.square.col]
      : null

  const showImpasse = !result && isHumanTurn && impasse.kingInZone

  return (
    <section className="shogi-game" aria-label="Partida de shōgi" onKeyDown={handleKeyDown}>
      <p className={`shogi-turn${inCheck && !result ? ' in-check' : ''}${result ? ' finished' : ''}`} aria-live="polite">
        {statusText}
      </p>

      <div className="shogi-layout">
        <BoardView
          position={position}
          selection={input.selection}
          targets={input.targets}
          pending={input.pending}
          lastMove={hint ?? lastMove}
          flipped={flipped}
          showHints={showHints}
          canUseHand={(owner) => owner === position.turn && isHumanTurn && !result && !input.pending}
          handLabel={(owner) => `Mano de ${OWNER_SHORT[owner]}${aiActive && owner === aiSide ? ' · máquina' : ''}`}
          onSquare={input.selectSquare}
          onHand={input.selectHand}
        />

        <aside className="shogi-side-panel" aria-label="Información y controles">
          <div className="shogi-panel-section">
            <h3>Explicación</h3>
            <p className="shogi-message" aria-live="polite">{message}</p>
            {lastSearch && aiActive && <p className="muted search-info">{lastSearch}</p>}
          </div>

          {input.pending && (
            <PromotionChoice position={position} pending={input.pending} onChoose={input.choosePromotion} />
          )}

          {selectedPiece && !input.pending && (
            <div className="shogi-panel-section piece-info">
              <div className="piece-info-head">
                <span className={`piece-info-kanji${selectedPiece.promoted ? ' promoted' : ''}`} aria-hidden="true">
                  {pieceKanji(selectedPiece)}
                </span>
                <div>
                  <h3>{capitalize(pieceName(selectedPiece))}</h3>
                  <small>
                    {JAPANESE_NAMES[selectedPiece.kind]}
                    {selectedPiece.promoted ? ' (promocionada)' : ''}
                  </small>
                </div>
              </div>
              <p>{PIECE_TIPS[selectedPiece.kind]}</p>
              <p className="muted">{input.targets.length} destinos posibles.</p>
            </div>
          )}

          {showImpasse && (
            <div className="shogi-panel-section impasse">
              <h3>Impasse (jishōgi)</h3>
              <p>
                Tu rey ha entrado en campo rival. Puntos: <strong>{impasse.points}</strong> / {impasse.pointsNeeded} ·
                Piezas en zona: <strong>{impasse.piecesInZone}</strong> / 10
                {impasse.inCheck ? ' · No puedes declarar estando en jaque.' : ''}
              </p>
              <div className="shogi-buttons">
                <button type="button" onClick={handleImpasse} disabled={!impasse.canDeclare}>
                  Declarar impasse y ganar
                </button>
              </div>
            </div>
          )}

          <div className="shogi-panel-section shogi-controls">
            <h3>Partida</h3>

            <label>
              Modo
              <select
                value={mode}
                onChange={(event) => {
                  setMode(event.target.value as Mode)
                  setPractice(null)
                }}
              >
                <option value="ai">Contra la máquina</option>
                <option value="local">Dos jugadores (mismo dispositivo)</option>
              </select>
            </label>

            {mode === 'ai' && (
              <>
                <label>
                  Juegas con
                  <select
                    value={humanSide}
                    onChange={(event) => {
                      const side = event.target.value as Owner
                      setHumanSide(side)
                      startGame(
                        null,
                        `Nueva partida: juegas con ${OWNER_LABEL[side]}.${side === 'gote' ? ' La máquina mueve primero.' : ''}`,
                      )
                    }}
                  >
                    <option value="sente">Sente (azul, empieza)</option>
                    <option value="gote">Gote (rojo)</option>
                  </select>
                </label>

                <label>
                  Dificultad
                  <select value={difficulty} onChange={(event) => setDifficulty(event.target.value as Difficulty)}>
                    {(Object.keys(DIFFICULTY_LABEL) as Difficulty[]).map((level) => (
                      <option value={level} key={level}>
                        {DIFFICULTY_LABEL[level]}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}

            <label className="checkbox">
              <input type="checkbox" checked={showHints} onChange={(event) => setShowHints(event.target.checked)} />
              Mostrar jugadas posibles
            </label>

            <div className="shogi-buttons">
              <button type="button" onClick={() => startGame(null)}>
                Nueva partida
              </button>
              <button type="button" onClick={handleUndo} disabled={game.history.length === 0}>
                Deshacer
              </button>
              <button type="button" onClick={handleHint} disabled={result !== null || !isHumanTurn || hintLoading}>
                {hintLoading ? 'Pensando…' : 'Pista'}
              </button>
              <button type="button" onClick={handleResign} disabled={result !== null}>
                Rendirse
              </button>
            </div>

            {progress.games.played > 0 && (
              <p className="muted">
                Contra la máquina: {progress.games.won} victorias · {progress.games.lost} derrotas ·{' '}
                {progress.games.drawn} tablas
              </p>
            )}
          </div>

          <div className="shogi-panel-section">
            <h3>Posiciones de práctica</h3>
            <div className="practice-list">
              {PRACTICE_POSITIONS.map((entry) => (
                <button
                  type="button"
                  key={entry.id}
                  className={practice?.id === entry.id ? 'active' : ''}
                  onClick={() => startGame(entry)}
                >
                  {entry.goal === 'mate' ? '詰 ' : ''}
                  {entry.title}
                </button>
              ))}
            </div>
            {practice && <p className="muted practice-note">Modo práctica: tú mueves ambos bandos.</p>}
          </div>

          <div className="shogi-panel-section">
            <h3>Registro (kifu)</h3>
            {kifu.length === 0 ? (
              <p className="muted">Todavía no hay jugadas.</p>
            ) : (
              <ol className="kifu">
                {kifu.map((text, index) => (
                  <li key={index}>{text}</li>
                ))}
              </ol>
            )}
          </div>

          <details className="shogi-panel-section export-panel">
            <summary>Exportar e importar</summary>
            <div className="shogi-buttons">
              <button type="button" onClick={downloadKif} disabled={game.history.length === 0}>
                Descargar KIF
              </button>
              <button type="button" onClick={copySfen}>
                Copiar SFEN
              </button>
            </div>
            <label className="sfen-label">
              Cargar posición SFEN
              <textarea
                value={sfenInput}
                onChange={(event) => setSfenInput(event.target.value)}
                rows={3}
                placeholder="lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1"
                spellCheck={false}
              />
            </label>
            <div className="shogi-buttons">
              <button type="button" onClick={loadSfen} disabled={sfenInput.trim() === ''}>
                Cargar SFEN
              </button>
            </div>
            <p className="muted">
              KIF es el formato de registro japonés más extendido; SFEN describe una posición en una sola línea.
            </p>
          </details>
        </aside>
      </div>
    </section>
  )
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
