import './ShogiBoard.css'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { Difficulty } from '../engine/ai'
import { explainIllegalBoardMove, explainIllegalDrop, describeMove } from '../engine/explain'
import { isCheck, newGame, playMove, resign, undo, type GameState } from '../engine/game'
import { FILE_LABELS, formatMove, RANK_LABELS, squareLabel } from '../engine/notation'
import {
  JAPANESE_NAMES,
  OWNER_LABEL,
  OWNER_SHORT,
  PIECE_KANJI,
  PIECE_NAMES,
  PIECE_TIPS,
  pieceKanji,
  pieceMovement,
  pieceName,
} from '../engine/pieces'
import { PRACTICE_POSITIONS, type PracticePosition } from '../engine/positions'
import {
  findKing,
  HAND_ORDER,
  legalDrops,
  legalMovesFrom,
  otherOwner,
  sameSquare,
} from '../engine/rules'
import type { GameResult, HandKind, Move, Owner, Piece, Square } from '../engine/types'
import { useAiPlayer } from '../hooks/useAiPlayer'

type Mode = 'ai' | 'local'

type Selection =
  | { type: 'square'; square: Square }
  | { type: 'hand'; kind: HandKind }
  | null

type PendingPromotion = { from: Square; to: Square }

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'Fácil',
  normal: 'Normal',
  hard: 'Difícil',
}

const INDICES = [0, 1, 2, 3, 4, 5, 6, 7, 8]

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
  }
}

function ShogiPiece({ piece, upsideDown }: { piece: Piece; upsideDown: boolean }) {
  return (
    <span
      className={`shogi-piece${upsideDown ? ' upside-down' : ''}${piece.promoted ? ' promoted' : ''}`}
      aria-hidden="true"
    >
      {pieceKanji(piece)}
    </span>
  )
}

export default function ShogiBoard() {
  const [game, setGame] = useState<GameState>(() => newGame())
  const [selection, setSelection] = useState<Selection>(null)
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null)
  const [mode, setMode] = useState<Mode>('ai')
  const [humanSide, setHumanSide] = useState<Owner>('sente')
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  const [showHints, setShowHints] = useState(true)
  const [message, setMessage] = useState(
    'Juegas con Sente (azul). Selecciona una pieza para ver sus movimientos posibles.',
  )
  const [practice, setPractice] = useState<PracticePosition | null>(null)
  const { requestMove, cancel } = useAiPlayer()

  const { position, result } = game
  const aiSide = otherOwner(humanSide)
  const aiActive = mode === 'ai' && practice === null
  const isHumanTurn = !aiActive || position.turn === humanSide
  const thinking = aiActive && !result && position.turn === aiSide
  const inCheck = isCheck(game)
  const flipped = aiActive && humanSide === 'gote'
  const lastEntry = game.history.at(-1)
  const lastMove = lastEntry?.move

  const targets = useMemo<Square[]>(() => {
    if (!selection || result) return []
    if (selection.type === 'hand') return legalDrops(position, selection.kind)
    return legalMovesFrom(position, selection.square).map((move) => move.to)
  }, [selection, position, result])

  const checkedKing = inCheck ? findKing(position.board, position.turn) : null

  const kifu = useMemo(
    () =>
      game.history.map((entry, index) => {
        const previous = index > 0 ? game.history[index - 1].move.to : null
        return formatMove(entry.before, entry.move, previous)
      }),
    [game.history],
  )

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
    setSelection(null)
    setPendingPromotion(null)
    setMessage(text)
  }

  // El efecto de la máquina usa siempre la versión más reciente de `commit`.
  const commitRef = useRef(commit)
  useEffect(() => {
    commitRef.current = commit
  })

  // Turno de la máquina.
  useEffect(() => {
    if (!aiActive || result || position.turn !== aiSide) return

    return requestMove(position, difficulty, (move) => {
      if (move) commitRef.current(game, move, true)
    })
  }, [game, position, result, aiActive, aiSide, difficulty, requestMove])

  function startGame(nextPractice: PracticePosition | null, note?: string) {
    cancel()
    const start = nextPractice ? nextPractice.create() : undefined
    setGame(newGame(start))
    setPractice(nextPractice)
    setSelection(null)
    setPendingPromotion(null)
    setMessage(
      note ??
        (nextPractice
          ? nextPractice.description
          : 'Nueva partida. Sente (azul) mueve primero.'),
    )
  }

  function handleUndo() {
    if (game.history.length === 0) return
    cancel()
    // Contra la máquina se deshace también su respuesta.
    const plies = aiActive && position.turn === humanSide && game.history.length >= 2 ? 2 : 1
    setGame(undo(game, plies))
    setSelection(null)
    setPendingPromotion(null)
    setMessage(plies === 2 ? 'Se han deshecho tu última jugada y la respuesta de la máquina.' : 'Jugada deshecha.')
  }

  function handleResign() {
    if (result) return
    const loser = aiActive ? humanSide : position.turn
    cancel()
    const next = resign(game, loser)
    setGame(next)
    setSelection(null)
    setPendingPromotion(null)
    setMessage(resultMessage(next.result!))
  }

  function selectHandPiece(kind: HandKind) {
    if (pendingPromotion || result || !isHumanTurn) return

    if (selection?.type === 'hand' && selection.kind === kind) {
      setSelection(null)
      return
    }

    const count = legalDrops(position, kind).length
    setSelection({ type: 'hand', kind })
    setMessage(
      count > 0
        ? `${PIECE_KANJI[kind]} (${PIECE_NAMES[kind]}) seleccionado: puedes colocarlo en ${count} casillas.`
        : `${PIECE_KANJI[kind]} (${PIECE_NAMES[kind]}): ahora mismo no hay ninguna casilla donde colocarlo legalmente.`,
    )
  }

  function handleSquare(square: Square) {
    if (result || pendingPromotion || !isHumanTurn) return

    const clicked = position.board[square.row][square.col]

    if (selection?.type === 'hand') {
      const reason = explainIllegalDrop(position, selection.kind, square)
      if (reason) {
        if (clicked?.owner === position.turn) {
          setSelection({ type: 'square', square })
          setMessage(describeSelection(clicked))
          return
        }
        setMessage(reason)
        return
      }
      commit(game, { type: 'drop', piece: selection.kind, to: square }, false)
      return
    }

    if (selection?.type === 'square') {
      const from = selection.square

      if (sameSquare(from, square)) {
        setSelection(null)
        setMessage('Selección cancelada.')
        return
      }

      if (clicked?.owner === position.turn) {
        setSelection({ type: 'square', square })
        setMessage(describeSelection(clicked))
        return
      }

      const options = legalMovesFrom(position, from).filter((move) => sameSquare(move.to, square))

      if (options.length === 0) {
        setMessage(explainIllegalBoardMove(position, from, square) ?? 'Movimiento no válido.')
        return
      }

      if (options.length === 1) {
        commit(game, options[0], false)
        return
      }

      setPendingPromotion({ from, to: square })
      setMessage('Tu pieza entra, sale o se mueve dentro de la zona de promoción. ¿Quieres promocionarla?')
      return
    }

    if (clicked?.owner === position.turn) {
      setSelection({ type: 'square', square })
      setMessage(describeSelection(clicked))
    } else if (clicked) {
      setMessage(`Esa pieza es de ${OWNER_LABEL[clicked.owner]}. Ahora juega ${OWNER_LABEL[position.turn]}.`)
    }
  }

  function describeSelection(piece: Piece): string {
    return `${pieceKanji(piece)} · ${pieceName(piece)}. ${pieceMovement(piece)}`
  }

  function choosePromotion(promote: boolean) {
    if (!pendingPromotion) return
    const { from, to } = pendingPromotion
    commit(game, { type: 'move', from, to, promote }, false)
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      setSelection(null)
      setPendingPromotion(null)
    }
  }

  const statusText = result
    ? resultMessage(result)
    : thinking
      ? 'La máquina está pensando…'
      : `Turno de ${OWNER_LABEL[position.turn]}${inCheck ? ' — ¡JAQUE!' : ''}`

  const rows = flipped ? [...INDICES].reverse() : INDICES
  const cols = flipped ? [...INDICES].reverse() : INDICES

  const selectedPiece =
    selection?.type === 'square' ? position.board[selection.square.row][selection.square.col] : null

  function renderHand(owner: Owner) {
    const hand = position.hands[owner]
    const isTurn = owner === position.turn
    const canUse = isTurn && isHumanTurn && !result && !pendingPromotion
    const total = HAND_ORDER.reduce((sum, kind) => sum + hand[kind], 0)

    return (
      <div className={`shogi-hand ${owner}${isTurn && !result ? ' active' : ''}`}>
        <strong>
          {owner === 'sente' ? '☗' : '☖'} Mano de {OWNER_SHORT[owner]}
          {aiActive && owner === aiSide ? ' · máquina' : ''}
        </strong>

        <div className="shogi-hand-pieces">
          {HAND_ORDER.map((kind) => {
            const count = hand[kind]
            if (count === 0) return null
            const isSelected = isTurn && selection?.type === 'hand' && selection.kind === kind

            return (
              <button
                type="button"
                key={kind}
                className={`shogi-hand-piece${isSelected ? ' selected' : ''}`}
                disabled={!canUse}
                onClick={() => selectHandPiece(kind)}
                aria-pressed={isSelected}
                aria-label={`${PIECE_NAMES[kind]} en la mano, cantidad ${count}`}
              >
                <span aria-hidden="true">{PIECE_KANJI[kind]}</span>
                {count > 1 && <small aria-hidden="true">×{count}</small>}
              </button>
            )
          })}

          {total === 0 && <span className="shogi-hand-empty">Sin piezas</span>}
        </div>
      </div>
    )
  }

  return (
    <section className="shogi-game" aria-label="Partida de shōgi" onKeyDown={handleKeyDown}>
      <p className={`shogi-turn${inCheck && !result ? ' in-check' : ''}${result ? ' finished' : ''}`} aria-live="polite">
        {statusText}
      </p>

      <div className="shogi-layout">
        <div className="shogi-board-column">
          {renderHand(flipped ? 'sente' : 'gote')}

          <div className="shogi-board-coordinate-frame">
            <div className="shogi-file-coordinates" aria-hidden="true">
              {cols.map((col) => (
                <span key={col}>{FILE_LABELS[col]}</span>
              ))}
            </div>

            <div className="shogi-board-and-ranks">
              <div className="shogi-rank-coordinates" aria-hidden="true">
                {rows.map((row) => (
                  <span key={row}>{RANK_LABELS[row]}</span>
                ))}
              </div>

              <div className="shogi-grid" role="grid" aria-label="Tablero de 9 por 9">
                {rows.map((row) => (
                  <div className="shogi-row" role="row" key={row}>
                    {cols.map((col) => {
                      const square = { row, col }
                      const piece = position.board[row][col]
                      const isSelected = selection?.type === 'square' && sameSquare(selection.square, square)
                      const isTarget = showHints && targets.some((t) => sameSquare(t, square))
                      const isLast =
                        lastMove !== undefined &&
                        (sameSquare(lastMove.to, square) ||
                          (lastMove.type === 'move' && sameSquare(lastMove.from, square)))
                      const isChecked = checkedKing !== null && sameSquare(checkedKing, square)
                      const isPending = pendingPromotion !== null && sameSquare(pendingPromotion.to, square)

                      const classes = [
                        'shogi-square',
                        isSelected && `selected-${position.turn}`,
                        isTarget && (piece ? 'capture-hint' : 'move-hint'),
                        isLast && 'last-move',
                        isChecked && 'in-check',
                        isPending && 'pending',
                      ]
                        .filter(Boolean)
                        .join(' ')

                      const label = `${squareLabel(square)}, ${
                        piece ? `${pieceName(piece)} de ${OWNER_SHORT[piece.owner]}` : 'vacía'
                      }${isTarget ? ', destino posible' : ''}${isChecked ? ', rey en jaque' : ''}`

                      return (
                        <button
                          type="button"
                          role="gridcell"
                          className={classes}
                          key={col}
                          onClick={() => handleSquare(square)}
                          aria-label={label}
                          aria-selected={isSelected}
                        >
                          {piece && (
                            <ShogiPiece piece={piece} upsideDown={(piece.owner === 'gote') !== flipped} />
                          )}
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {renderHand(flipped ? 'gote' : 'sente')}
        </div>

        <aside className="shogi-side-panel" aria-label="Información y controles">
          <div className="shogi-panel-section">
            <h3>Explicación</h3>
            <p className="shogi-message" aria-live="polite">{message}</p>
          </div>

          {pendingPromotion && (
            <div className="promotion-choice shogi-panel-section" role="group" aria-label="Elegir promoción">
              <h3>Promoción</h3>
              {(() => {
                const piece = position.board[pendingPromotion.from.row][pendingPromotion.from.col]
                if (!piece) return null
                const promoted = { ...piece, promoted: true }
                return (
                  <p>
                    <span className="promotion-preview" aria-hidden="true">
                      {pieceKanji(piece)} → <em>{pieceKanji(promoted)}</em>
                    </span>
                    <strong>{capitalize(pieceName(promoted))}</strong>: {pieceMovement(promoted)}
                  </p>
                )
              })()}
              <div className="promotion-buttons">
                <button type="button" onClick={() => choosePromotion(true)}>
                  Promocionar
                </button>
                <button type="button" className="secondary" onClick={() => choosePromotion(false)}>
                  No promocionar
                </button>
              </div>
            </div>
          )}

          {selectedPiece && !pendingPromotion && (
            <div className="shogi-panel-section piece-info">
              <div className="piece-info-head">
                <span className={`piece-info-kanji${selectedPiece.promoted ? ' promoted' : ''}`} aria-hidden="true">
                  {pieceKanji(selectedPiece)}
                </span>
                <div>
                  <h3>{capitalize(pieceName(selectedPiece))}</h3>
                  <small>{JAPANESE_NAMES[selectedPiece.kind]}{selectedPiece.promoted ? ' (promocionada)' : ''}</small>
                </div>
              </div>
              <p>{PIECE_TIPS[selectedPiece.kind]}</p>
              <p className="muted">{targets.length} destinos posibles.</p>
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
                      startGame(null, `Nueva partida: juegas con ${OWNER_LABEL[side]}.${side === 'gote' ? ' La máquina mueve primero.' : ''}`)
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
              <button type="button" onClick={() => startGame(null)}>Nueva partida</button>
              <button type="button" onClick={handleUndo} disabled={game.history.length === 0}>Deshacer</button>
              <button type="button" onClick={handleResign} disabled={result !== null}>Rendirse</button>
            </div>
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
        </aside>
      </div>
    </section>
  )
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
