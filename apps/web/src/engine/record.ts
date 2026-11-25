import { fromUsi, FILE_LABELS, RANK_LABELS, toUsi } from './notation'
import { PIECE_KANJI, PROMOTED_KANJI } from './pieces'
import { BOARD_SIZE, emptyBoard, emptyHands, HAND_ORDER, promotionOptions } from './rules'
import { newGame, playMove, type GameState } from './game'
import type { HandKind, Piece, PieceKind, Position } from './types'

const SFEN_LETTER: Record<PieceKind, string> = {
  king: 'k', rook: 'r', bishop: 'b', gold: 'g', silver: 's', knight: 'n', lance: 'l', pawn: 'p',
}

const LETTER_KIND: Record<string, PieceKind> = Object.fromEntries(
  Object.entries(SFEN_LETTER).map(([kind, letter]) => [letter, kind as PieceKind]),
)

export const INITIAL_SFEN = 'lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1'

/** Convierte una posición a SFEN (formato estándar de los programas de shōgi). */
export function toSfen(position: Position, moveNumber = 1): string {
  const ranks: string[] = []

  for (const row of position.board) {
    let text = ''
    let empty = 0

    for (const piece of row) {
      if (!piece) {
        empty++
        continue
      }
      if (empty > 0) {
        text += empty
        empty = 0
      }
      const letter = SFEN_LETTER[piece.kind]
      text += (piece.promoted ? '+' : '') + (piece.owner === 'sente' ? letter.toUpperCase() : letter)
    }

    if (empty > 0) text += empty
    ranks.push(text)
  }

  let hands = ''
  for (const owner of ['sente', 'gote'] as const) {
    for (const kind of HAND_ORDER) {
      const count = position.hands[owner][kind]
      if (count === 0) continue
      const letter = SFEN_LETTER[kind]
      hands += (count > 1 ? count : '') + (owner === 'sente' ? letter.toUpperCase() : letter)
    }
  }

  return `${ranks.join('/')} ${position.turn === 'sente' ? 'b' : 'w'} ${hands || '-'} ${moveNumber}`
}

/** Lee una posición SFEN. Lanza un error si el texto no es válido. */
export function fromSfen(sfen: string): Position {
  const parts = sfen.trim().replace(/^sfen\s+/, '').split(/\s+/)
  if (parts.length < 3) throw new Error('SFEN incompleto: se esperan tablero, turno y manos.')

  const [boardText, turnText, handText] = parts
  const rows = boardText.split('/')
  if (rows.length !== BOARD_SIZE) throw new Error('El tablero SFEN debe tener 9 filas.')

  const board = emptyBoard()

  rows.forEach((rowText, row) => {
    let col = 0
    let promoted = false

    for (const char of rowText) {
      if (char === '+') {
        promoted = true
        continue
      }

      if (/[1-9]/.test(char)) {
        col += Number(char)
        continue
      }

      const kind = LETTER_KIND[char.toLowerCase()]
      if (!kind || col >= BOARD_SIZE) throw new Error(`Carácter no válido en la fila ${row + 1}: ${char}`)

      const piece: Piece = { kind, owner: char === char.toUpperCase() ? 'sente' : 'gote' }
      if (promoted) piece.promoted = true
      board[row][col++] = piece
      promoted = false
    }

    if (col !== BOARD_SIZE) throw new Error(`La fila ${row + 1} no tiene 9 casillas.`)
  })

  if (turnText !== 'b' && turnText !== 'w') throw new Error('El turno debe ser "b" (Sente) o "w" (Gote).')

  const hands = emptyHands()
  if (handText !== '-') {
    const pattern = /(\d*)([RBGSNLPrbgsnlp])/g
    let match: RegExpExecArray | null
    let consumed = 0
    while ((match = pattern.exec(handText)) !== null) {
      const owner = match[2] === match[2].toUpperCase() ? 'sente' : 'gote'
      const kind = LETTER_KIND[match[2].toLowerCase()] as HandKind
      hands[owner][kind] += match[1] ? Number(match[1]) : 1
      consumed += match[0].length
    }
    if (consumed !== handText.length) throw new Error('Las piezas en mano no son válidas.')
  }

  return { board, hands, turn: turnText === 'b' ? 'sente' : 'gote' }
}

/** Partida guardable: posición inicial en SFEN y movimientos en USI. */
export type SavedGame = { sfen: string; moves: string[] }

export function serializeGame(state: GameState): SavedGame {
  return {
    sfen: toSfen(state.start),
    moves: state.history.map((entry) => toUsi(entry.move)),
  }
}

/** Reconstruye una partida a partir de SFEN y movimientos USI (comprueba la legalidad). */
export function deserializeGame(saved: SavedGame): GameState {
  let state = newGame(fromSfen(saved.sfen))
  for (const text of saved.moves) {
    const move = fromUsi(text)
    if (!move) throw new Error(`Movimiento USI no válido: ${text}`)
    state = playMove(state, move)
  }
  return state
}

const FULL_WIDTH_DIGITS = ['０', '１', '２', '３', '４', '５', '６', '７', '８', '９']

/** Exporta la partida en formato KIF (compatible con la mayoría de programas japoneses). */
export function toKif(state: GameState, sente = 'Sente', gote = 'Gote'): string {
  const lines: string[] = [
    '# ---- Exportado desde shōgi ----',
    `開始日時：${formatDate(new Date())}`,
  ]

  if (toSfen(state.start) === INITIAL_SFEN) {
    lines.push('手合割：平手')
  } else {
    lines.push(`# Posición inicial (SFEN): ${toSfen(state.start)}`)
  }

  lines.push(`先手：${sente}`, `後手：${gote}`, '手数----指手---------消費時間--')

  state.history.forEach((entry, index) => {
    const { move, before } = entry
    const previous = index > 0 ? state.history[index - 1].move.to : null
    const same = previous && previous.row === move.to.row && previous.col === move.to.col

    const destination = same
      ? '同　'
      : `${FULL_WIDTH_DIGITS[FILE_LABELS[move.to.col]]}${RANK_LABELS[move.to.row]}`

    let text: string
    if (move.type === 'drop') {
      text = `${destination}${PIECE_KANJI[move.piece]}打`
    } else {
      const piece = before.board[move.from.row][move.from.col]!
      const name = piece.kind === 'king'
        ? '玉'
        : piece.promoted
          ? kifPromotedName(piece.kind)
          : PIECE_KANJI[piece.kind]
      const promotion = move.promote
        ? '成'
        : promotionOptions(piece, move.from, move.to).canPromote
          ? '不成'
          : ''
      text = `${destination}${name}${promotion}(${FILE_LABELS[move.from.col]}${move.from.row + 1})`
    }

    lines.push(`${String(index + 1).padStart(4)} ${text}`)
  })

  if (state.result) {
    lines.push(`${String(state.history.length + 1).padStart(4)} ${kifResult(state)}`)
  }

  return lines.join('\n') + '\n'
}

function kifPromotedName(kind: PieceKind): string {
  // En KIF se escriben 成香, 成桂 y 成銀 en lugar de los kanji abreviados.
  if (kind === 'lance') return '成香'
  if (kind === 'knight') return '成桂'
  if (kind === 'silver') return '成銀'
  return PROMOTED_KANJI[kind] ?? PIECE_KANJI[kind]
}

function kifResult(state: GameState): string {
  switch (state.result?.reason) {
    case 'checkmate':
    case 'no-moves':
      return '詰み'
    case 'resignation':
      return '投了'
    case 'repetition':
      return '千日手'
    case 'perpetual-check':
      return '反則負け'
    case 'impasse':
      return '入玉勝ち'
    default:
      return '中断'
  }
}

function formatDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
