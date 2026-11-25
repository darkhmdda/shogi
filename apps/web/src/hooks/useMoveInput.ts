import { useMemo, useState } from 'react'
import { explainIllegalBoardMove, explainIllegalDrop } from '../engine/explain'
import { OWNER_LABEL, PIECE_KANJI, PIECE_NAMES, pieceKanji, pieceMovement, pieceName } from '../engine/pieces'
import { legalDrops, legalMovesFrom, sameSquare } from '../engine/rules'
import type { HandKind, Move, Piece, Position, Square } from '../engine/types'

export type Selection =
  | { type: 'square'; square: Square }
  | { type: 'hand'; kind: HandKind }
  | null

export type PendingPromotion = { from: Square; to: Square }

type InputState = {
  position: Position
  selection: Selection
  pending: PendingPromotion | null
}

type Options = {
  enabled: boolean
  onMove: (move: Move) => void
  onMessage: (text: string) => void
}

export function describeSelection(piece: Piece): string {
  return `${pieceKanji(piece)} · ${pieceName(piece)}. ${pieceMovement(piece)}`
}

/**
 * Gestiona la selección de piezas, las colocaciones y la elección de promoción.
 * La selección se descarta sola cuando cambia la posición.
 */
export function useMoveInput(position: Position, { enabled, onMove, onMessage }: Options) {
  const [state, setState] = useState<InputState>({ position, selection: null, pending: null })
  const fresh = state.position === position
  const selection = fresh ? state.selection : null
  const pending = fresh ? state.pending : null

  const set = (next: Partial<Omit<InputState, 'position'>>) =>
    setState({ position, selection, pending, ...next })

  const targets = useMemo<Square[]>(() => {
    if (!selection) return []
    if (selection.type === 'hand') return legalDrops(position, selection.kind)
    return legalMovesFrom(position, selection.square).map((move) => move.to)
  }, [selection, position])

  function clear() {
    set({ selection: null, pending: null })
  }

  function play(move: Move) {
    set({ selection: null, pending: null })
    onMove(move)
  }

  function selectHand(kind: HandKind) {
    if (!enabled || pending) return

    if (selection?.type === 'hand' && selection.kind === kind) {
      clear()
      return
    }

    const count = legalDrops(position, kind).length
    set({ selection: { type: 'hand', kind } })
    onMessage(
      count > 0
        ? `${PIECE_KANJI[kind]} (${PIECE_NAMES[kind]}) seleccionado: puedes colocarlo en ${count} casillas.`
        : `${PIECE_KANJI[kind]} (${PIECE_NAMES[kind]}): ahora mismo no hay ninguna casilla donde colocarlo legalmente.`,
    )
  }

  function selectSquare(square: Square) {
    if (!enabled || pending) return

    const clicked = position.board[square.row][square.col]

    if (selection?.type === 'hand') {
      const reason = explainIllegalDrop(position, selection.kind, square)
      if (!reason) {
        play({ type: 'drop', piece: selection.kind, to: square })
        return
      }
      if (clicked?.owner === position.turn) {
        set({ selection: { type: 'square', square } })
        onMessage(describeSelection(clicked))
        return
      }
      onMessage(reason)
      return
    }

    if (selection?.type === 'square') {
      const from = selection.square

      if (sameSquare(from, square)) {
        clear()
        onMessage('Selección cancelada.')
        return
      }

      if (clicked?.owner === position.turn) {
        set({ selection: { type: 'square', square } })
        onMessage(describeSelection(clicked))
        return
      }

      const options = legalMovesFrom(position, from).filter((move) => sameSquare(move.to, square))

      if (options.length === 0) {
        onMessage(explainIllegalBoardMove(position, from, square) ?? 'Movimiento no válido.')
        return
      }

      if (options.length === 1) {
        play(options[0])
        return
      }

      set({ pending: { from, to: square } })
      onMessage('La pieza entra, sale o se mueve dentro de la zona de promoción. ¿Quieres promocionarla?')
      return
    }

    if (clicked?.owner === position.turn) {
      set({ selection: { type: 'square', square } })
      onMessage(describeSelection(clicked))
    } else if (clicked) {
      onMessage(`Esa pieza es de ${OWNER_LABEL[clicked.owner]}. Ahora juega ${OWNER_LABEL[position.turn]}.`)
    }
  }

  function choosePromotion(promote: boolean) {
    if (!pending) return
    play({ type: 'move', from: pending.from, to: pending.to, promote })
  }

  return { selection, pending, targets, selectSquare, selectHand, choosePromotion, clear }
}
