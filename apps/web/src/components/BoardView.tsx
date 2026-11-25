import './ShogiBoard.css'
import { FILE_LABELS, RANK_LABELS, squareLabel } from '@shogi/engine'
import {
  OWNER_SHORT,
  PIECE_KANJI,
  PIECE_NAMES,
  pieceKanji,
  pieceMovement,
  pieceName,
} from '@shogi/engine'
import { findKing, HAND_ORDER, isInCheck, sameSquare } from '@shogi/engine'
import type { HandKind, Move, Owner, Piece, Position, Square } from '@shogi/engine'
import type { PendingPromotion, Selection } from '@shogi/react'

const INDICES = [0, 1, 2, 3, 4, 5, 6, 7, 8]

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

type BoardViewProps = {
  position: Position
  selection: Selection
  targets: Square[]
  pending: PendingPromotion | null
  lastMove?: Move
  flipped?: boolean
  showHints?: boolean
  /** Si el jugador puede usar las piezas de la mano de `owner`. */
  canUseHand: (owner: Owner) => boolean
  handLabel?: (owner: Owner) => string
  onSquare: (square: Square) => void
  onHand: (kind: HandKind) => void
  /** Ocultar una mano (por ejemplo, la del defensor en un tsume). */
  hideHand?: Owner
}

/** Tablero con coordenadas y manos. No contiene lógica de juego. */
export default function BoardView({
  position,
  selection,
  targets,
  pending,
  lastMove,
  flipped = false,
  showHints = true,
  canUseHand,
  handLabel,
  onSquare,
  onHand,
  hideHand,
}: BoardViewProps) {
  const rows = flipped ? [...INDICES].reverse() : INDICES
  const cols = flipped ? [...INDICES].reverse() : INDICES
  const checkedKing = isInCheck(position.board, position.turn) ? findKing(position.board, position.turn) : null

  function renderHand(owner: Owner) {
    if (owner === hideHand) return null

    const hand = position.hands[owner]
    const isTurn = owner === position.turn
    const usable = canUseHand(owner)
    const total = HAND_ORDER.reduce((sum, kind) => sum + hand[kind], 0)

    return (
      <div className={`shogi-hand ${owner}${isTurn ? ' active' : ''}`}>
        <strong>
          {owner === 'sente' ? '☗' : '☖'} {handLabel ? handLabel(owner) : `Mano de ${OWNER_SHORT[owner]}`}
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
                disabled={!usable}
                onClick={() => onHand(kind)}
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
                  const isPending = pending !== null && sameSquare(pending.to, square)

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
                      onClick={() => onSquare(square)}
                      aria-label={label}
                      aria-selected={isSelected}
                    >
                      {piece && <ShogiPiece piece={piece} upsideDown={(piece.owner === 'gote') !== flipped} />}
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
  )
}

/** Panel para elegir si se promociona una pieza. */
export function PromotionChoice({
  position,
  pending,
  onChoose,
}: {
  position: Position
  pending: PendingPromotion
  onChoose: (promote: boolean) => void
}) {
  const piece = position.board[pending.from.row][pending.from.col]
  if (!piece) return null
  const promoted = { ...piece, promoted: true }
  const name = pieceName(promoted)

  return (
    <div className="promotion-choice shogi-panel-section" role="group" aria-label="Elegir promoción">
      <h3>Promoción</h3>
      <p>
        <span className="promotion-preview" aria-hidden="true">
          {pieceKanji(piece)} → <em>{pieceKanji(promoted)}</em>
        </span>
        <strong>{name.charAt(0).toUpperCase() + name.slice(1)}</strong>: {pieceMovement(promoted)}
      </p>
      <div className="promotion-buttons">
        <button type="button" onClick={() => onChoose(true)}>
          Promocionar
        </button>
        <button type="button" className="secondary" onClick={() => onChoose(false)}>
          No promocionar
        </button>
      </div>
    </div>
  )
}
