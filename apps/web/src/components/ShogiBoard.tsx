
import './ShogiBoard.css'

type PieceKind = 'K' | 'R' | 'B' | 'G' | 'S' | 'N' | 'L' | 'P'

type Piece = {
  kind: PieceKind
  owner: 'sente' | 'gote'
  promoted?: boolean
}

const backRank: PieceKind[] = [
  'L', 'N', 'S', 'G', 'K', 'G', 'S', 'N', 'L',
]

function createInitialBoard(): (Piece | null)[][] {
  const board: (Piece | null)[][] = Array.from(
    { length: 9 },
    () => Array<Piece | null>(9).fill(null),
  )

  for (let col = 0; col < 9; col++) {
    board[0][col] = { kind: backRank[8 - col], owner: 'gote' }
    board[2][col] = { kind: 'P', owner: 'gote' }
    board[6][col] = { kind: 'P', owner: 'sente' }
    board[8][col] = { kind: backRank[col], owner: 'sente' }
  }

  board[1][1] = { kind: 'R', owner: 'gote' }
  board[1][7] = { kind: 'B', owner: 'gote' }
  board[7][1] = { kind: 'B', owner: 'sente' }
  board[7][7] = { kind: 'R', owner: 'sente' }

  return board
}

const pieceKanji: Record<PieceKind, string> = {
  K: '玉',
  R: '飛',
  B: '角',
  G: '金',
  S: '銀',
  N: '桂',
  L: '香',
  P: '歩',
}

const promotedKanji: Partial<Record<PieceKind, string>> = {
  R: '龍',
  B: '馬',
  S: '全',
  N: '圭',
  L: '杏',
  P: 'と',
}

function ShogiPiece({ piece }: { piece: Piece }) {
  const label = piece.promoted
    ? promotedKanji[piece.kind] ?? pieceKanji[piece.kind]
    : pieceKanji[piece.kind]

  return (
    <div
      className={`shogi-piece ${piece.owner} ${piece.promoted ? 'promoted' : ''}`}
      aria-label={`${piece.owner === 'sente' ? 'Negro' : 'Blanco'}: ${label}`}
    >
      <span>{label}</span>
    </div>
  )
}

export default function ShogiBoard() {
  const board = createInitialBoard()

  return (
    <section className="shogi-game" aria-label="Tablero de shōgi">
      <div className="player-label opponent-label">
        <span className="player-stone gote-stone">後</span>
        <div>
          <strong>Gote</strong>
          <span>Segundo jugador</span>
        </div>
      </div>

      <div className="board-frame">
        <div className="board-coordinates top-coordinates" aria-hidden="true">
          {['９', '８', '７', '６', '５', '４', '３', '２', '１'].map((n) => (
            <span key={n}>{n}</span>
          ))}
        </div>

        <div className="board-middle">
          <div className="board-coordinates side-coordinates" aria-hidden="true">
            {'abcdefghi'.split('').map((n) => (
              <span key={n}>{n}</span>
            ))}
          </div>

          <div className="shogi-grid" role="grid" aria-label="Tablero de 9 por 9">
            {board.map((row, rowIndex) =>
              row.map((piece, colIndex) => (
                <div
                  className="shogi-square"
                  role="gridcell"
                  key={`${rowIndex}-${colIndex}`}
                  aria-label={`Fila ${rowIndex + 1}, columna ${colIndex + 1}${piece ? `, pieza ${pieceKanji[piece.kind]}` : ', vacía'}`}
                >
                  {piece && <ShogiPiece piece={piece} />}
                </div>
              )),
            )}
          </div>
        </div>

        <div className="board-coordinates bottom-coordinates" aria-hidden="true">
          {['９', '８', '７', '６', '５', '４', '３', '２', '１'].map((n) => (
            <span key={n}>{n}</span>
          ))}
        </div>
      </div>

      <div className="player-label current-player-label">
        <span className="player-stone sente-stone">先</span>
        <div>
          <strong>Sente</strong>
          <span>Primer jugador · Tú</span>
        </div>
        <span className="turn-indicator">Turno inicial</span>
      </div>
    </section>
  )
}
