import './PieceGuide.css'
import { useState } from 'react'
import { movePatternFor } from '@shogi/engine'
import {
  JAPANESE_NAMES,
  PIECE_TIPS,
  pieceKanji,
  pieceMovement,
  pieceName,
} from '@shogi/engine'
import type { PieceKind } from '@shogi/engine'

const KINDS: PieceKind[] = ['king', 'rook', 'bishop', 'gold', 'silver', 'knight', 'lance', 'pawn']
const PROMOTABLE: PieceKind[] = ['rook', 'bishop', 'silver', 'knight', 'lance', 'pawn']

const SIZE = 5
const CENTER = 2

/** Diagrama 5×5 con las casillas a las que llega la pieza (vista de Sente). */
function MoveDiagram({ kind, promoted }: { kind: PieceKind; promoted: boolean }) {
  const pattern = movePatternFor(kind, promoted)
  const steps = new Set(pattern.steps.map(([dr, dc]) => `${CENTER + dr},${CENTER + dc}`))
  const slides = new Set<string>()

  for (const [dr, dc] of pattern.slides) {
    for (let distance = 1; distance < SIZE; distance++) {
      const row = CENTER + dr * distance
      const col = CENTER + dc * distance
      if (row < 0 || row >= SIZE || col < 0 || col >= SIZE) break
      slides.add(`${row},${col}`)
    }
  }

  return (
    <div className="move-diagram" aria-hidden="true">
      {Array.from({ length: SIZE * SIZE }, (_, index) => {
        const row = Math.floor(index / SIZE)
        const col = index % SIZE
        const key = `${row},${col}`
        const isCenter = row === CENTER && col === CENTER
        const className = isCenter
          ? 'center'
          : steps.has(key)
            ? 'step'
            : slides.has(key)
              ? 'slide'
              : ''

        return (
          <span key={key} className={className}>
            {isCenter ? pieceKanji({ kind, owner: 'sente', promoted }) : ''}
          </span>
        )
      })}
    </div>
  )
}

export default function PieceGuide() {
  const [showPromoted, setShowPromoted] = useState(false)
  const kinds = showPromoted ? PROMOTABLE : KINDS

  return (
    <div className="piece-guide">
      <div className="piece-guide-toolbar" role="group" aria-label="Tipo de piezas">
        <button type="button" className={!showPromoted ? 'active' : ''} onClick={() => setShowPromoted(false)}>
          Piezas básicas
        </button>
        <button type="button" className={showPromoted ? 'active' : ''} onClick={() => setShowPromoted(true)}>
          Piezas promocionadas
        </button>
        <span className="piece-guide-legend">
          <i className="step" /> una casilla
          <i className="slide" /> cualquier distancia
        </span>
      </div>

      <div className="piece-guide-grid">
        {kinds.map((kind) => {
          const piece = { kind, promoted: showPromoted }
          return (
            <article className="piece-card" key={`${kind}-${showPromoted}`}>
              <MoveDiagram kind={kind} promoted={showPromoted} />
              <div>
                <h3>{capitalize(pieceName(piece))}</h3>
                <small>
                  {JAPANESE_NAMES[kind]}
                  {showPromoted ? ' · promocionada' : ''}
                </small>
                <p>{pieceMovement(piece)}</p>
                {!showPromoted && <p className="piece-tip">{PIECE_TIPS[kind]}</p>}
              </div>
            </article>
          )
        })}
      </div>

      <div className="rules-summary">
        <h3>Reglas esenciales</h3>
        <ul>
          <li><strong>Capturas:</strong> la pieza capturada pasa a tu mano y, en lugar de mover, puedes colocarla en cualquier casilla vacía.</li>
          <li><strong>Promoción:</strong> las tres últimas filas son la zona de promoción. Al entrar, salir o moverte dentro de ella puedes promocionar; es obligatorio si la pieza ya no podría moverse.</li>
          <li><strong>Nifu (二歩):</strong> nunca puedes tener dos peones sin promocionar en la misma columna.</li>
          <li><strong>Uchifuzume (打ち歩詰め):</strong> no se puede dar jaque mate colocando un peón desde la mano.</li>
          <li><strong>Sennichite (千日手):</strong> si la misma posición se repite cuatro veces, es tablas; pero quien repite dando jaque continuo pierde.</li>
          <li><strong>Fin:</strong> gana quien da jaque mate. Quedarse sin jugadas legales también es derrota.</li>
        </ul>
      </div>
    </div>
  )
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
