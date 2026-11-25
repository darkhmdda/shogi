"""
Reglas del shōgi en Python para validar las partidas en línea en el servidor.

Es un port fiel de packages/engine/src/rules.ts (mismas coordenadas, mismas
reglas) y se verifica con los mismos valores de perft. Coordenadas: board[row][col],
row 0 = fila 一 (lado de Gote), col 0 = columna 9.
"""

from __future__ import annotations

from dataclasses import dataclass, field

SENTE, GOTE = "sente", "gote"
HAND_ORDER = ("rook", "bishop", "gold", "silver", "knight", "lance", "pawn")

ORTHOGONAL = ((-1, 0), (1, 0), (0, -1), (0, 1))
DIAGONAL = ((-1, -1), (-1, 1), (1, -1), (1, 1))
ALL_ADJACENT = ORTHOGONAL + DIAGONAL
GOLD_STEPS = ((-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, 0))
SILVER_STEPS = ((-1, -1), (-1, 0), (-1, 1), (1, -1), (1, 1))

LETTER = {"king": "k", "rook": "r", "bishop": "b", "gold": "g", "silver": "s", "knight": "n", "lance": "l", "pawn": "p"}
KIND = {letter: kind for kind, letter in LETTER.items()}


@dataclass(frozen=True)
class Piece:
    kind: str
    owner: str
    promoted: bool = False


@dataclass(frozen=True)
class Move:
    to: tuple[int, int]
    frm: tuple[int, int] | None = None  # None = colocación desde la mano
    piece: str | None = None  # tipo colocado
    promote: bool = False


@dataclass
class Position:
    board: list[list[Piece | None]]
    hands: dict[str, dict[str, int]] = field(default_factory=lambda: {SENTE: _empty_hand(), GOTE: _empty_hand()})
    turn: str = SENTE

    def copy(self) -> Position:
        return Position(
            board=[row[:] for row in self.board],
            hands={owner: dict(hand) for owner, hand in self.hands.items()},
            turn=self.turn,
        )


def _empty_hand() -> dict[str, int]:
    return {kind: 0 for kind in HAND_ORDER}


def other(owner: str) -> str:
    return GOTE if owner == SENTE else SENTE


def pattern(kind: str, promoted: bool) -> tuple[tuple, tuple]:
    """(pasos, deslizamientos) desde el punto de vista de Sente."""
    if promoted:
        if kind == "rook":
            return DIAGONAL, ORTHOGONAL
        if kind == "bishop":
            return ORTHOGONAL, DIAGONAL
        if kind in ("pawn", "lance", "knight", "silver"):
            return GOLD_STEPS, ()
    return {
        "king": (ALL_ADJACENT, ()),
        "rook": ((), ORTHOGONAL),
        "bishop": ((), DIAGONAL),
        "gold": (GOLD_STEPS, ()),
        "silver": (SILVER_STEPS, ()),
        "knight": (((-2, -1), (-2, 1)), ()),
        "lance": ((), ((-1, 0),)),
        "pawn": (((-1, 0),), ()),
    }[kind]


def in_bounds(row: int, col: int) -> bool:
    return 0 <= row < 9 and 0 <= col < 9


def attacked_squares(board, row: int, col: int) -> list[tuple[int, int]]:
    piece = board[row][col]
    sign = 1 if piece.owner == SENTE else -1
    steps, slides = pattern(piece.kind, piece.promoted)
    result = []
    for dr, dc in steps:
        r, c = row + dr * sign, col + dc * sign
        if in_bounds(r, c):
            result.append((r, c))
    for dr, dc in slides:
        r, c = row + dr * sign, col + dc * sign
        while in_bounds(r, c):
            result.append((r, c))
            if board[r][c] is not None:
                break
            r, c = r + dr * sign, c + dc * sign
    return result


def _attacks_along(piece: Piece, dr: int, dc: int, distance: int) -> bool:
    sign = 1 if piece.owner == SENTE else -1
    steps, slides = pattern(piece.kind, piece.promoted)
    if distance == 1 and any(sr * sign == dr and sc * sign == dc for sr, sc in steps):
        return True
    return any(sr * sign == dr and sc * sign == dc for sr, sc in slides)


def is_attacked(board, row: int, col: int, by: str) -> bool:
    for dr, dc in ALL_ADJACENT:
        r, c, distance = row + dr, col + dc, 1
        while in_bounds(r, c):
            piece = board[r][c]
            if piece is not None:
                if piece.owner == by and _attacks_along(piece, -dr, -dc, distance):
                    return True
                break
            r, c, distance = r + dr, c + dc, distance + 1
    knight_row = row + (2 if by == SENTE else -2)
    for dc in (-1, 1):
        c = col + dc
        if in_bounds(knight_row, c):
            piece = board[knight_row][c]
            if piece is not None and piece.owner == by and piece.kind == "knight" and not piece.promoted:
                return True
    return False


def find_king(board, owner: str) -> tuple[int, int] | None:
    for r in range(9):
        for c in range(9):
            piece = board[r][c]
            if piece is not None and piece.kind == "king" and piece.owner == owner:
                return r, c
    return None


def in_check(board, owner: str) -> bool:
    king = find_king(board, owner)
    return king is not None and is_attacked(board, king[0], king[1], other(owner))


def in_zone(owner: str, row: int) -> bool:
    return row <= 2 if owner == SENTE else row >= 6


def dead_end(kind: str, owner: str, row: int) -> bool:
    distance = row if owner == SENTE else 8 - row
    if kind in ("pawn", "lance"):
        return distance == 0
    if kind == "knight":
        return distance <= 1
    return False


def apply_move(position: Position, move: Move) -> Position:
    nxt = position.copy()
    owner = position.turn
    tr, tc = move.to
    if move.frm is None:
        nxt.board[tr][tc] = Piece(move.piece, owner)
        nxt.hands[owner][move.piece] -= 1
    else:
        fr, fc = move.frm
        piece = nxt.board[fr][fc]
        captured = nxt.board[tr][tc]
        if captured is not None and captured.kind != "king":
            nxt.hands[owner][captured.kind] += 1
        nxt.board[fr][fc] = None
        nxt.board[tr][tc] = Piece(piece.kind, piece.owner, True) if move.promote else piece
    nxt.turn = other(owner)
    return nxt


def _safe(position: Position, move: Move) -> bool:
    return not in_check(apply_move(position, move).board, position.turn)


def _board_moves(position: Position, row: int, col: int) -> list[Move]:
    piece = position.board[row][col]
    moves = []
    for tr, tc in attacked_squares(position.board, row, col):
        target = position.board[tr][tc]
        if target is not None and target.owner == piece.owner:
            continue
        can = (
            not piece.promoted
            and piece.kind not in ("king", "gold")
            and (in_zone(piece.owner, row) or in_zone(piece.owner, tr))
        )
        must = can and dead_end(piece.kind, piece.owner, tr)
        for promote in ((True, False) if can and not must else (True,) if must else (False,)):
            move = Move(to=(tr, tc), frm=(row, col), promote=promote)
            if _safe(position, move):
                moves.append(move)
    return moves


def _pawn_on_file(board, owner: str, col: int) -> bool:
    return any(
        (p := board[r][col]) is not None and p.owner == owner and p.kind == "pawn" and not p.promoted for r in range(9)
    )


def _pawn_drop_mate(position: Position, to: tuple[int, int]) -> bool:
    nxt = apply_move(position, Move(to=to, piece="pawn"))
    if not in_check(nxt.board, nxt.turn):
        return False
    for r in range(9):
        for c in range(9):
            piece = nxt.board[r][c]
            if piece is not None and piece.owner == nxt.turn and _board_moves(nxt, r, c):
                return False
    return True


def legal_moves(position: Position) -> list[Move]:
    moves: list[Move] = []
    owner = position.turn
    for r in range(9):
        for c in range(9):
            piece = position.board[r][c]
            if piece is not None and piece.owner == owner:
                moves.extend(_board_moves(position, r, c))
    checked = in_check(position.board, owner)
    for kind in HAND_ORDER:
        if position.hands[owner][kind] <= 0:
            continue
        for r in range(9):
            for c in range(9):
                if position.board[r][c] is not None or dead_end(kind, owner, r):
                    continue
                if kind == "pawn" and _pawn_on_file(position.board, owner, c):
                    continue
                move = Move(to=(r, c), piece=kind)
                if checked and not _safe(position, move):
                    continue
                if kind == "pawn" and _pawn_drop_mate(position, (r, c)):
                    continue
                moves.append(move)
    return moves


# ---------------------------------------------------------------------------
# SFEN y USI
# ---------------------------------------------------------------------------

INITIAL_SFEN = "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1"


def from_sfen(sfen: str) -> Position:
    parts = sfen.split()
    board: list[list[Piece | None]] = []
    for rank in parts[0].split("/"):
        row: list[Piece | None] = []
        promoted = False
        for ch in rank:
            if ch == "+":
                promoted = True
            elif ch.isdigit():
                row.extend([None] * int(ch))
            else:
                row.append(Piece(KIND[ch.lower()], SENTE if ch.isupper() else GOTE, promoted))
                promoted = False
        if len(row) != 9:
            raise ValueError("Fila SFEN no válida")
        board.append(row)
    if len(board) != 9:
        raise ValueError("Tablero SFEN no válido")
    position = Position(board=board, turn=SENTE if parts[1] == "b" else GOTE)
    if parts[2] != "-":
        count = ""
        for ch in parts[2]:
            if ch.isdigit():
                count += ch
            else:
                position.hands[SENTE if ch.isupper() else GOTE][KIND[ch.lower()]] += int(count or 1)
                count = ""
    return position


def to_sfen(position: Position, move_number: int = 1) -> str:
    ranks = []
    for row in position.board:
        text, empty = "", 0
        for piece in row:
            if piece is None:
                empty += 1
                continue
            if empty:
                text, empty = text + str(empty), 0
            letter = LETTER[piece.kind]
            text += ("+" if piece.promoted else "") + (letter.upper() if piece.owner == SENTE else letter)
        ranks.append(text + (str(empty) if empty else ""))
    hands = ""
    for owner in (SENTE, GOTE):
        for kind in HAND_ORDER:
            n = position.hands[owner][kind]
            if n:
                letter = LETTER[kind]
                hands += (str(n) if n > 1 else "") + (letter.upper() if owner == SENTE else letter)
    return f"{'/'.join(ranks)} {'b' if position.turn == SENTE else 'w'} {hands or '-'} {move_number}"


def _usi_square(text: str) -> tuple[int, int]:
    return ord(text[1]) - 97, 9 - int(text[0])


def from_usi(text: str) -> Move:
    if text[1] == "*":
        return Move(to=_usi_square(text[2:4]), piece=KIND[text[0].lower()])
    return Move(to=_usi_square(text[2:4]), frm=_usi_square(text[0:2]), promote=text.endswith("+"))


def to_usi(move: Move) -> str:
    def sq(s: tuple[int, int]) -> str:
        return f"{9 - s[1]}{chr(97 + s[0])}"

    if move.frm is None:
        return f"{LETTER[move.piece].upper()}*{sq(move.to)}"
    return f"{sq(move.frm)}{sq(move.to)}{'+' if move.promote else ''}"


def position_key(position: Position) -> str:
    return to_sfen(position, 0)


# ---------------------------------------------------------------------------
# Partida
# ---------------------------------------------------------------------------


class IllegalMove(ValueError):
    pass


@dataclass
class Replay:
    position: Position
    winner: str | None
    reason: str | None


def replay(start_sfen: str, moves: list[str]) -> Replay:
    """Reproduce la partida validando cada jugada y devuelve el estado final."""
    position = from_sfen(start_sfen)
    keys = [position_key(position)]
    checks: list[tuple[str, bool]] = []

    for index, text in enumerate(moves):
        try:
            move = from_usi(text)
        except (KeyError, ValueError, IndexError) as error:
            raise IllegalMove(f"Jugada {index + 1} mal escrita: {text}") from error
        if move not in legal_moves(position):
            raise IllegalMove(f"Jugada {index + 1} ilegal: {text}")
        mover = position.turn
        position = apply_move(position, move)
        checks.append((mover, in_check(position.board, position.turn)))
        keys.append(position_key(position))

    winner, reason = result_of(position, keys, checks)
    return Replay(position, winner, reason)


def result_of(position: Position, keys: list[str], checks: list[tuple[str, bool]]) -> tuple[str | None, str | None]:
    if not legal_moves(position):
        return other(position.turn), ("checkmate" if in_check(position.board, position.turn) else "no-moves")

    current = keys[-1]
    occurrences = [i for i, key in enumerate(keys) if key == current]
    if len(occurrences) >= 4:
        cycle = checks[occurrences[0]:]
        for owner in (SENTE, GOTE):
            own = [gives for mover, gives in cycle if mover == owner]
            if own and all(own):
                return other(owner), "perpetual-check"
        return None, "repetition"
    return None, None
