
import './ShogiBoard.css'
import { useState } from 'react'

type PieceKind =
  | 'king'
  | 'rook'
  | 'bishop'
  | 'gold'
  | 'silver'
  | 'knight'
  | 'lance'
  | 'pawn'

type Owner = 'sente' | 'gote'

type Piece = {
  kind: PieceKind
  owner: Owner
  promoted?: boolean
}

type Square = {
  row: number
  col: number
}

type Hands = Record<Owner, PieceKind[]>

type GameStatus = 'playing' | 'check' | 'checkmate' | 'stalemate'

const pieceKanji: Record<PieceKind, string> = {
  king: '玉',
  rook: '飛',
  bishop: '角',
  gold: '金',
  silver: '銀',
  knight: '桂',
  lance: '香',
  pawn: '歩',
}

const pieceNames: Record<PieceKind, string> = {
  king: 'rey',
  rook: 'torre',
  bishop: 'alfil',
  gold: 'oro',
  silver: 'plata',
  knight: 'caballo',
  lance: 'lanza',
  pawn: 'peón',
}

const promotedKanji: Partial<Record<PieceKind, string>> = {
  rook: '龍',
  bishop: '馬',
  silver: '全',
  knight: '圭',
  lance: '杏',
  pawn: 'と',
}

const handOrder: PieceKind[] = [
  'rook',
  'bishop',
  'gold',
  'silver',
  'knight',
  'lance',
  'pawn',
]

const fileCoordinates = [9, 8, 7, 6, 5, 4, 3, 2, 1]

const rankCoordinates = [
  '一', '二', '三', '四', '五', '六', '七', '八', '九',
]

function createInitialBoard(): (Piece | null)[][] {
  const board: (Piece | null)[][] = Array.from(
    { length: 9 },
    () => Array(9).fill(null),
  )

  const backRow: PieceKind[] = [
    'lance', 'knight', 'silver', 'gold', 'king',
    'gold', 'silver', 'knight', 'lance',
  ]

  for (let col = 0; col < 9; col++) {
    board[0][col] = { kind: backRow[col], owner: 'gote' }
    board[2][col] = { kind: 'pawn', owner: 'gote' }
    board[6][col] = { kind: 'pawn', owner: 'sente' }
    board[8][col] = { kind: backRow[col], owner: 'sente' }
  }

  board[1][1] = { kind: 'rook', owner: 'gote' }
  board[1][7] = { kind: 'bishop', owner: 'gote' }
  board[7][1] = { kind: 'bishop', owner: 'sente' }
  board[7][7] = { kind: 'rook', owner: 'sente' }

  return board
}

function ShogiPiece({ piece }: { piece: Piece }) {
  const kanji = piece.promoted
    ? promotedKanji[piece.kind] ?? pieceKanji[piece.kind]
    : pieceKanji[piece.kind]

  return (
    <span
      className={`shogi-piece ${piece.owner === 'gote' ? 'gote' : 'sente'}${piece.promoted ? ' promoted' : ''}`}
      aria-label={`${piece.owner === 'sente' ? 'Sente' : 'Gote'} ${pieceNames[piece.kind]}${piece.promoted ? ', promocionada' : ''}`}
    >
      {kanji}
    </span>
  )
}

function otherOwner(owner: Owner): Owner {
  return owner === 'sente' ? 'gote' : 'sente'
}

function isPromotable(piece: Piece): boolean {
  return (
    piece.promoted !== true &&
    piece.kind !== 'king' &&
    piece.kind !== 'gold'
  )
}

function inPromotionZone(owner: Owner, row: number): boolean {
  return owner === 'sente' ? row <= 2 : row >= 6
}

function mustPromote(piece: Piece, destinationRow: number): boolean {
  if (piece.promoted) return false

  const lastRow = piece.owner === 'sente' ? 0 : 8
  const lastTwoRows =
    piece.owner === 'sente'
      ? destinationRow <= 1
      : destinationRow >= 7

  if (piece.kind === 'pawn' || piece.kind === 'lance') {
    return destinationRow === lastRow
  }

  return piece.kind === 'knight' && lastTwoRows
}

function isGoldMove(
  piece: Piece,
  dr: number,
  dc: number,
): boolean {
  const forward = piece.owner === 'sente' ? -1 : 1

  return (
    (dr === forward && Math.abs(dc) <= 1) ||
    (dr === 0 && Math.abs(dc) === 1) ||
    (dr === -forward && dc === 0)
  )
}

function isValidMove(
  board: (Piece | null)[][],
  piece: Piece,
  from: Square,
  to: Square,
): boolean {
  if (
    to.row < 0 || to.row > 8 ||
    to.col < 0 || to.col > 8
  ) return false

  const dr = to.row - from.row
  const dc = to.col - from.col
  const forward = piece.owner === 'sente' ? -1 : 1
  const absRow = Math.abs(dr)
  const absCol = Math.abs(dc)
  const destination = board[to.row][to.col]

  if (dr === 0 && dc === 0) return false
  if (destination?.owner === piece.owner) return false

  // En shogi no se captura directamente al rey.
  if (destination?.kind === 'king') return false

  if (
    piece.promoted &&
    ['pawn', 'lance', 'knight', 'silver'].includes(piece.kind)
  ) {
    return isGoldMove(piece, dr, dc)
  }

  if (piece.kind === 'king') {
    return absRow <= 1 && absCol <= 1
  }

  if (piece.kind === 'gold') {
    return isGoldMove(piece, dr, dc)
  }

  if (piece.kind === 'pawn') {
    return dr === forward && dc === 0
  }

  if (piece.kind === 'silver') {
    return (
      (dr === forward && absCol <= 1) ||
      (dr === -forward && absCol === 1)
    )
  }

  if (piece.kind === 'knight') {
    return dr === forward * 2 && absCol === 1
  }

  if (piece.kind === 'lance' || piece.kind === 'rook') {
    const straight =
      (dc === 0 && dr !== 0) ||
      (piece.kind === 'rook' && dr === 0 && dc !== 0)

    if (!straight) {
      return (
        piece.kind === 'rook' &&
        piece.promoted === true &&
        absRow === 1 &&
        absCol === 1
      )
    }

    if (piece.kind === 'lance' && dr * forward <= 0) {
      return false
    }

    const rowStep = Math.sign(dr)
    const colStep = Math.sign(dc)
    let r = from.row + rowStep
    let c = from.col + colStep

    while (r !== to.row || c !== to.col) {
      if (board[r][c] !== null) return false
      r += rowStep
      c += colStep
    }

    return true
  }

  if (piece.kind === 'bishop') {
    if (absRow === absCol) {
      const rowStep = Math.sign(dr)
      const colStep = Math.sign(dc)
      let r = from.row + rowStep
      let c = from.col + colStep

      while (r !== to.row || c !== to.col) {
        if (board[r][c] !== null) return false
        r += rowStep
        c += colStep
      }

      return true
    }

    return (
      piece.promoted === true &&
      absRow + absCol === 1
    )
  }

  return false
}

function makeBoardMove(
  board: (Piece | null)[][],
  from: Square,
  to: Square,
): (Piece | null)[][] {
  const nextBoard = board.map((row) => [...row])
  nextBoard[to.row][to.col] = nextBoard[from.row][from.col]
  nextBoard[from.row][from.col] = null
  return nextBoard
}

function findKing(
  board: (Piece | null)[][],
  owner: Owner,
): Square | null {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const piece = board[row][col]
      if (piece?.kind === 'king' && piece.owner === owner) {
        return { row, col }
      }
    }
  }

  return null
}

function isSquareAttacked(
  board: (Piece | null)[][],
  row: number,
  col: number,
  byOwner: Owner,
): boolean {
  const target = { row, col }

  // La casilla objetivo se vacía para poder calcular ataques
  // incluso cuando allí se encuentra el rey.
  const attackBoard = board.map((boardRow) => [...boardRow])
  attackBoard[row][col] = null

  for (let fromRow = 0; fromRow < 9; fromRow++) {
    for (let fromCol = 0; fromCol < 9; fromCol++) {
      const piece = attackBoard[fromRow][fromCol]

      if (!piece || piece.owner !== byOwner) continue

      if (
        isValidMove(
          attackBoard,
          piece,
          { row: fromRow, col: fromCol },
          target,
        )
      ) {
        return true
      }
    }
  }

  return false
}

function isKingInCheck(
  board: (Piece | null)[][],
  owner: Owner,
): boolean {
  const king = findKing(board, owner)

  if (!king) return true

  return isSquareAttacked(
    board,
    king.row,
    king.col,
    otherOwner(owner),
  )
}

function isLegalBoardMove(
  board: (Piece | null)[][],
  piece: Piece,
  from: Square,
  to: Square,
): boolean {
  if (!isValidMove(board, piece, from, to)) return false

  const nextBoard = makeBoardMove(board, from, to)

  return !isKingInCheck(nextBoard, piece.owner)
}

function canDropPiece(
  board: (Piece | null)[][],
  kind: PieceKind,
  owner: Owner,
  row: number,
  col: number,
): boolean {
  if (board[row][col] !== null) return false

  const lastRow = owner === 'sente' ? 0 : 8
  const lastTwoRows = owner === 'sente' ? row <= 1 : row >= 7

  if (
    (kind === 'pawn' || kind === 'lance') &&
    row === lastRow
  ) return false

  if (kind === 'knight' && lastTwoRows) return false

  // Nifu: no se permiten dos peones propios sin promocionar
  // en la misma columna.
  if (kind === 'pawn') {
    for (let r = 0; r < 9; r++) {
      const piece = board[r][col]

      if (
        piece?.owner === owner &&
        piece.kind === 'pawn' &&
        !piece.promoted
      ) {
        return false
      }
    }
  }

  return true
}

function isLegalDrop(
  board: (Piece | null)[][],
  kind: PieceKind,
  owner: Owner,
  row: number,
  col: number,
): boolean {
  if (!canDropPiece(board, kind, owner, row, col)) return false

  const nextBoard = board.map((boardRow) => [...boardRow])
  nextBoard[row][col] = { kind, owner }

  return !isKingInCheck(nextBoard, owner)
}

type LegalAction = {
  from?: Square
  to: Square
  drop?: PieceKind
}

function getLegalActions(
  board: (Piece | null)[][],
  owner: Owner,
  hands: Hands,
): LegalAction[] {
  const actions: LegalAction[] = []

  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const piece = board[row][col]
      if (!piece || piece.owner !== owner) continue

      const from = { row, col }

      for (let toRow = 0; toRow < 9; toRow++) {
        for (let toCol = 0; toCol < 9; toCol++) {
          const to = { row: toRow, col: toCol }

          if (isLegalBoardMove(board, piece, from, to)) {
            actions.push({ from, to })
          }
        }
      }
    }
  }

  // Comprobar también todas las colocaciones disponibles.
  for (const kind of new Set(hands[owner])) {
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (isLegalDrop(board, kind, owner, row, col)) {
          actions.push({ to: { row, col }, drop: kind })
        }
      }
    }
  }

  return actions
}

function getGameStatus(
  board: (Piece | null)[][],
  owner: Owner,
  hands: Hands,
): GameStatus {
  const inCheck = isKingInCheck(board, owner)
  const actions = getLegalActions(board, owner, hands)

  if (actions.length === 0) {
    return inCheck ? 'checkmate' : 'stalemate'
  }

  return inCheck ? 'check' : 'playing'
}

function emptyHands(): Hands {
  return { sente: [], gote: [] }
}

function createCheckTestPosition(): (Piece | null)[][] {
  const board: (Piece | null)[][] = Array.from(
    { length: 9 },
    () => Array(9).fill(null),
  )

  // Sente's rook attacks Gote's king along the same file.
  board[0][4] = { kind: 'king', owner: 'gote' }
  board[4][4] = { kind: 'rook', owner: 'sente' }
  board[8][4] = { kind: 'king', owner: 'sente' }

  return board
}

function createCheckmateTestPosition(): (Piece | null)[][] {
  const board: (Piece | null)[][] = Array.from(
    { length: 9 },
    () => Array(9).fill(null),
  )

  // Position de prueba: rey rojo en una esquina.
  // Las piezas azules controlan sus tres casillas de escape
  // y la torre da jaque por la columna.
  board[0][0] = { kind: 'king', owner: 'gote' }
  board[1][2] = { kind: 'rook', owner: 'sente' }
  board[2][1] = { kind: 'gold', owner: 'sente' }
  board[1][0] = { kind: 'gold', owner: 'sente' }
  board[8][8] = { kind: 'king', owner: 'sente' }

  return board
}

export default function ShogiBoard() {
  const [board, setBoard] = useState<(Piece | null)[][]>(
    createInitialBoard,
  )
  const [selectedSquare, setSelectedSquare] =
    useState<Square | null>(null)
  const [currentTurn, setCurrentTurn] = useState<Owner>('sente')
  const [pendingPromotion, setPendingPromotion] =
    useState<Square | null>(null)
  const [hands, setHands] = useState<Hands>(emptyHands)
  const [selectedHandPiece, setSelectedHandPiece] =
    useState<PieceKind | null>(null)
  const [message, setMessage] = useState('')

  const gameStatus = getGameStatus(board, currentTurn, hands)
  const gameOver =
    gameStatus === 'checkmate' || gameStatus === 'stalemate'

  function finishTurn() {
    setPendingPromotion(null)
    setSelectedSquare(null)
    setSelectedHandPiece(null)
    setCurrentTurn((turn) => otherOwner(turn))
  }

  function loadPosition(
    nextBoard: (Piece | null)[][],
    nextTurn: Owner,
    nextMessage: string,
  ) {
    setBoard(nextBoard)
    setHands(emptyHands())
    setCurrentTurn(nextTurn)
    setSelectedSquare(null)
    setSelectedHandPiece(null)
    setPendingPromotion(null)
    setMessage(nextMessage)
  }

  function restartGame() {
    loadPosition(createInitialBoard(), 'sente', 'Partida reiniciada.')
  }

  function startCheckTest() {
    loadPosition(
      createCheckTestPosition(),
      'gote',
      'Prueba de jaque: el rey rojo está amenazado por la torre azul.',
    )
  }

  function startCheckmateTest() {
    const testBoard = createCheckmateTestPosition()
    const status = getGameStatus(testBoard, 'gote', emptyHands())

    loadPosition(
      testBoard,
      'gote',
      status === 'checkmate'
        ? 'Posición de prueba de jaque mate cargada.'
        : 'Posición de prueba cargada. Comprueba el estado que muestra el tablero.',
    )
  }

  function choosePromotion(promote: boolean) {
    if (!pendingPromotion) return

    const nextBoard = board.map((row) => [...row])

    if (promote) {
      const { row, col } = pendingPromotion
      const piece = nextBoard[row][col]

      if (piece) {
        nextBoard[row][col] = { ...piece, promoted: true }
      }
    }

    setBoard(nextBoard)

    const opponent = otherOwner(currentTurn)
    const givesCheck = isKingInCheck(nextBoard, opponent)

    setMessage(
      givesCheck
        ? `${promote ? 'Pieza promocionada. ' : ''}¡Jaque a ${opponent === 'sente' ? 'Sente' : 'Gote'}!`
        : promote
          ? 'Pieza promocionada.'
          : 'Movimiento completado.',
    )

    finishTurn()
  }

  function selectHandPiece(kind: PieceKind) {
    if (pendingPromotion || gameOver) return

    setSelectedSquare(null)
    setSelectedHandPiece(kind)
    setMessage(
      `Seleccionaste ${pieceKanji[kind]} (${pieceNames[kind]}). Elige una casilla vacía.`,
    )
  }

  function dropHandPiece(row: number, col: number): boolean {
    if (!selectedHandPiece) return false

    if (!isLegalDrop(board, selectedHandPiece, currentTurn, row, col)) {
      setMessage(
        canDropPiece(board, selectedHandPiece, currentTurn, row, col)
          ? 'Movimiento no válido: no puedes dejar a tu rey en jaque.'
          : 'No puedes colocar esa pieza en esa casilla.',
      )
      return true
    }

    const kind = selectedHandPiece
    const nextBoard = board.map((boardRow) => [...boardRow])
    nextBoard[row][col] = { kind, owner: currentTurn }

    const nextHands = { ...hands }
    const pieces = [...nextHands[currentTurn]]
    const index = pieces.indexOf(kind)

    if (index !== -1) pieces.splice(index, 1)
    nextHands[currentTurn] = pieces

    setBoard(nextBoard)
    setHands(nextHands)

    const opponent = otherOwner(currentTurn)
    const givesCheck = isKingInCheck(nextBoard, opponent)

    setMessage(
      givesCheck
        ? `Pieza colocada. ¡Jaque a ${opponent === 'sente' ? 'Sente' : 'Gote'}!`
        : 'Pieza colocada en el tablero.',
    )

    finishTurn()
    return true
  }

  function handleSquareClick(row: number, col: number) {
    if (gameOver || pendingPromotion) return

    if (selectedHandPiece) {
      dropHandPiece(row, col)
      return
    }

    const clickedPiece = board[row][col]

    if (selectedSquare === null) {
      if (clickedPiece?.owner === currentTurn) {
        setSelectedSquare({ row, col })
        setMessage('')
      }
      return
    }

    const { row: selectedRow, col: selectedCol } = selectedSquare
    const selectedPiece = board[selectedRow][selectedCol]

    if (!selectedPiece) {
      setSelectedSquare(null)
      return
    }

    if (selectedRow === row && selectedCol === col) {
      setSelectedSquare(null)
      return
    }

    if (clickedPiece?.owner === currentTurn) {
      setSelectedSquare({ row, col })
      return
    }

    const from = { row: selectedRow, col: selectedCol }
    const to = { row, col }

    if (!isLegalBoardMove(board, selectedPiece, from, to)) {
      setMessage(
        isValidMove(board, selectedPiece, from, to)
          ? 'Movimiento no válido: no puedes dejar a tu rey en jaque.'
          : 'Movimiento no válido.',
      )
      return
    }

    const nextBoard = makeBoardMove(board, from, to)
    const capturedPiece = clickedPiece

    setBoard(nextBoard)

    if (capturedPiece) {
      setHands((currentHands) => ({
        ...currentHands,
        [currentTurn]: [
          ...currentHands[currentTurn],
          { ...capturedPiece, promoted: false }.kind,
        ],
      }))
    }

    const opponent = otherOwner(currentTurn)
    const givesCheck = isKingInCheck(nextBoard, opponent)

    setMessage(
      givesCheck
        ? `¡Jaque a ${opponent === 'sente' ? 'Sente' : 'Gote'}!${capturedPiece ? ' Pieza capturada y añadida a tu mano.' : ''}`
        : capturedPiece
          ? 'Pieza capturada y añadida a tu mano.'
          : '',
    )

    setSelectedSquare(null)

    const canPromote =
      isPromotable(selectedPiece) &&
      (
        inPromotionZone(selectedPiece.owner, selectedRow) ||
        inPromotionZone(selectedPiece.owner, row)
      )

    const forcedPromotion = mustPromote(selectedPiece, row)

    if (canPromote || forcedPromotion) {
      setPendingPromotion(to)
    } else {
      finishTurn()
    }
  }

  const pendingPiece = pendingPromotion
    ? board[pendingPromotion.row][pendingPromotion.col]
    : null

  const promotionIsForced =
    pendingPiece != null &&
    pendingPromotion != null &&
    mustPromote(pendingPiece, pendingPromotion.row)

  const gameStatusMessage =
    gameStatus === 'checkmate'
      ? `¡JAQUE MATE! Gana ${currentTurn === 'sente' ? 'Gote (rojo)' : 'Sente (azul)'}.`
      : gameStatus === 'stalemate'
        ? 'Fin de partida: no hay movimientos legales y el rey no está en jaque.'
        : gameStatus === 'check'
          ? `¡JAQUE a ${currentTurn === 'sente' ? 'Sente (azul)' : 'Gote (rojo)'}!`
          : ''

  function renderHand(owner: Owner) {
    const isCurrentPlayer = owner === currentTurn
    const title = owner === 'sente' ? 'Mano de Sente' : 'Mano de Gote'
    const pieces = hands[owner]

    return (
      <div className={`shogi-hand ${owner}`} aria-label={title}>
        <strong>{title}</strong>

        <div className="shogi-hand-pieces">
          {handOrder.map((kind) => {
            const count = pieces.filter((piece) => piece === kind).length
            if (count === 0) return null

            const isSelected =
              isCurrentPlayer && selectedHandPiece === kind

            return (
              <button
                type="button"
                key={kind}
                className={`shogi-hand-piece${isSelected ? ' selected' : ''}`}
                disabled={!isCurrentPlayer || gameOver || Boolean(pendingPromotion)}
                onClick={() => selectHandPiece(kind)}
                aria-label={`${pieceKanji[kind]}, cantidad ${count}`}
              >
                <span>{pieceKanji[kind]}</span>
                {count > 1 && <small>×{count}</small>}
              </button>
            )
          })}

          {pieces.length === 0 && (
            <span className="shogi-hand-empty">Sin piezas</span>
          )}
        </div>
      </div>
    )
  }

  return (
    <section className="shogi-game" aria-label="Tablero de shōgi">
      <p className="shogi-turn" aria-live="polite">
        {gameOver
          ? gameStatusMessage
          : `Turno de: ${currentTurn === 'sente' ? 'Sente (azul)' : 'Gote (rojo)'}`}
        {!gameOver && gameStatus === 'check' && ' — ¡JAQUE!'}
      </p>

      <div className="shogi-game-controls">
        <button type="button" onClick={startCheckTest}>
          Probar jaque
        </button>
        <button type="button" onClick={startCheckmateTest}>
          Probar jaque mate
        </button>
        <button type="button" onClick={restartGame}>
          Reiniciar partida
        </button>
      </div>

      <div className="shogi-layout">
        <div className="shogi-board-column">
          {renderHand('gote')}

          <div className="shogi-board-coordinate-frame">
            <div className="shogi-file-coordinates" aria-hidden="true">
              {fileCoordinates.map((file) => (
                <span key={file}>{file}</span>
              ))}
            </div>

            <div className="shogi-board-and-ranks">
              <div className="shogi-rank-coordinates" aria-hidden="true">
                {rankCoordinates.map((rank) => (
                  <span key={rank}>{rank}</span>
                ))}
              </div>

              <div className="shogi-grid" role="grid" aria-label="Tablero de shōgi">
                {board.map((row, rowIndex) =>
                  row.map((piece, colIndex) => {
                    const isSelected =
                      selectedSquare?.row === rowIndex &&
                      selectedSquare?.col === colIndex

                    const selectedColor = isSelected
                      ? piece?.owner === 'sente'
                        ? 'selected-sente'
                        : 'selected-gote'
                      : ''

                    return (
                      <div
                        className={`shogi-square ${selectedColor}`}
                        onClick={() => handleSquareClick(rowIndex, colIndex)}
                        role="gridcell"
                        key={`${rowIndex}-${colIndex}`}
                        aria-label={`Fila ${rankCoordinates[rowIndex]}, columna ${fileCoordinates[colIndex]}${
                          piece ? `, pieza ${pieceKanji[piece.kind]}` : ', vacía'
                        }`}
                      >
                        {piece && <ShogiPiece piece={piece} />}
                      </div>
                    )
                  }),
                )}
              </div>
            </div>
          </div>

          {renderHand('sente')}
        </div>

        <aside className="shogi-side-panel" aria-label="Acciones e instrucciones">
          <div className="shogi-panel-section">
            <h3>Estado de la partida</h3>

            <p className="shogi-message" aria-live="polite">
              {gameOver ? gameStatusMessage : message || (
                gameStatus === 'check'
                  ? gameStatusMessage
                  : 'Selecciona una pieza del tablero o de tu mano para comenzar.'
              )}
            </p>
          </div>

          {pendingPromotion && pendingPiece && (
            <div
              className="promotion-choice shogi-panel-section"
              role="group"
              aria-label="Elegir promoción"
            >
              <h3>Promoción</h3>

              <p>
                ¿Quieres promocionar esta pieza?
                {promotionIsForced && ' La promoción es obligatoria.'}
              </p>

              <div className="promotion-buttons">
                <button type="button" onClick={() => choosePromotion(true)}>
                  Promocionar
                </button>

                {!promotionIsForced && (
                  <button
                    type="button"
                    className="secondary-promotion"
                    onClick={() => choosePromotion(false)}
                  >
                    No promocionar
                  </button>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>
    </section>
  )
}
