// @ts-nocheck
// ARCHIVO GENERADO por scripts/build-edge-function.mjs — no editar a mano.
// Código fuente: supabase/functions/online-move/main.ts y handler.ts
// y el motor de packages/engine. Regenerar con: npm run build:function
import { createClient } from "npm:@supabase/supabase-js@2";
const HAND_ORDER = [
	"rook",
	"bishop",
	"gold",
	"silver",
	"knight",
	"lance",
	"pawn"
];
const ORTHOGONAL = [
	[-1, 0],
	[1, 0],
	[0, -1],
	[0, 1]
];
const DIAGONAL = [
	[-1, -1],
	[-1, 1],
	[1, -1],
	[1, 1]
];
const ALL_ADJACENT = [...ORTHOGONAL, ...DIAGONAL];
const GOLD_STEPS = [
	[-1, -1],
	[-1, 0],
	[-1, 1],
	[0, -1],
	[0, 1],
	[1, 0]
];
const SILVER_STEPS = [
	[-1, -1],
	[-1, 0],
	[-1, 1],
	[1, -1],
	[1, 1]
];
const KNIGHT_STEPS = [[-2, -1], [-2, 1]];
const PAWN_STEPS = [[-1, 0]];
const LANCE_SLIDES = [[-1, 0]];
/** Patrón de movimiento de una pieza visto desde Sente. */
function movePatternFor(kind, promoted = false) {
	if (promoted) switch (kind) {
		case "rook": return {
			steps: DIAGONAL,
			slides: ORTHOGONAL
		};
		case "bishop": return {
			steps: ORTHOGONAL,
			slides: DIAGONAL
		};
		case "pawn":
		case "lance":
		case "knight":
		case "silver": return {
			steps: GOLD_STEPS,
			slides: []
		};
	}
	switch (kind) {
		case "king": return {
			steps: ALL_ADJACENT,
			slides: []
		};
		case "rook": return {
			steps: [],
			slides: ORTHOGONAL
		};
		case "bishop": return {
			steps: [],
			slides: DIAGONAL
		};
		case "gold": return {
			steps: GOLD_STEPS,
			slides: []
		};
		case "silver": return {
			steps: SILVER_STEPS,
			slides: []
		};
		case "knight": return {
			steps: KNIGHT_STEPS,
			slides: []
		};
		case "lance": return {
			steps: [],
			slides: LANCE_SLIDES
		};
		case "pawn": return {
			steps: PAWN_STEPS,
			slides: []
		};
	}
}
function otherOwner(owner) {
	return owner === "sente" ? "gote" : "sente";
}
function inBounds(row, col) {
	return row >= 0 && row < 9 && col >= 0 && col < 9;
}
function sameSquare(a, b) {
	return a.row === b.row && a.col === b.col;
}
function emptyHand() {
	return {
		rook: 0,
		bishop: 0,
		gold: 0,
		silver: 0,
		knight: 0,
		lance: 0,
		pawn: 0
	};
}
function emptyHands() {
	return {
		sente: emptyHand(),
		gote: emptyHand()
	};
}
function emptyBoard() {
	return Array.from({ length: 9 }, () => Array(9).fill(null));
}
function cloneBoard(board) {
	return board.map((row) => [...row]);
}
function clonePosition(position) {
	return {
		board: cloneBoard(position.board),
		hands: {
			sente: { ...position.hands.sente },
			gote: { ...position.hands.gote }
		},
		turn: position.turn
	};
}
function createInitialPosition() {
	const board = emptyBoard();
	const backRow = [
		"lance",
		"knight",
		"silver",
		"gold",
		"king",
		"gold",
		"silver",
		"knight",
		"lance"
	];
	for (let col = 0; col < 9; col++) {
		board[0][col] = {
			kind: backRow[col],
			owner: "gote"
		};
		board[2][col] = {
			kind: "pawn",
			owner: "gote"
		};
		board[6][col] = {
			kind: "pawn",
			owner: "sente"
		};
		board[8][col] = {
			kind: backRow[col],
			owner: "sente"
		};
	}
	board[1][1] = {
		kind: "rook",
		owner: "gote"
	};
	board[1][7] = {
		kind: "bishop",
		owner: "gote"
	};
	board[7][1] = {
		kind: "bishop",
		owner: "sente"
	};
	board[7][7] = {
		kind: "rook",
		owner: "sente"
	};
	return {
		board,
		hands: emptyHands(),
		turn: "sente"
	};
}
/** Casillas que una pieza situada en `from` ataca (sin importar jaques). */
function attackedSquares(board, from) {
	const piece = board[from.row][from.col];
	if (!piece) return [];
	const sign = piece.owner === "sente" ? 1 : -1;
	const pattern = movePatternFor(piece.kind, piece.promoted);
	const result = [];
	for (const [dr, dc] of pattern.steps) {
		const row = from.row + dr * sign;
		const col = from.col + dc * sign;
		if (inBounds(row, col)) result.push({
			row,
			col
		});
	}
	for (const [dr, dc] of pattern.slides) {
		let row = from.row + dr * sign;
		let col = from.col + dc * sign;
		while (inBounds(row, col)) {
			result.push({
				row,
				col
			});
			if (board[row][col] !== null) break;
			row += dr * sign;
			col += dc * sign;
		}
	}
	return result;
}
/** ¿Ataca `piece` desde una distancia `distance` en la dirección (dr, dc) hacia el objetivo? */
function attacksAlong(piece, dr, dc, distance) {
	const sign = piece.owner === "sente" ? 1 : -1;
	const pattern = movePatternFor(piece.kind, piece.promoted);
	if (distance === 1) {
		for (const [sr, sc] of pattern.steps) if (sr * sign === dr && sc * sign === dc) return true;
	}
	for (const [sr, sc] of pattern.slides) if (sr * sign === dr && sc * sign === dc) return true;
	return false;
}
/**
* Comprueba si `by` ataca la casilla `target` mirando hacia fuera desde ella:
* es mucho más rápido que generar los ataques de todas las piezas.
*/
function isSquareAttacked(board, target, by) {
	for (const [dr, dc] of ALL_ADJACENT) {
		let row = target.row + dr;
		let col = target.col + dc;
		let distance = 1;
		while (inBounds(row, col)) {
			const piece = board[row][col];
			if (piece) {
				if (piece.owner === by && attacksAlong(piece, -dr, -dc, distance)) return true;
				break;
			}
			row += dr;
			col += dc;
			distance++;
		}
	}
	const knightRow = target.row + (by === "sente" ? 2 : -2);
	for (const dc of [-1, 1]) {
		const col = target.col + dc;
		if (!inBounds(knightRow, col)) continue;
		const piece = board[knightRow][col];
		if (piece?.owner === by && piece.kind === "knight" && !piece.promoted) return true;
	}
	return false;
}
function findKing(board, owner) {
	for (let row = 0; row < 9; row++) for (let col = 0; col < 9; col++) {
		const piece = board[row][col];
		if (piece?.kind === "king" && piece.owner === owner) return {
			row,
			col
		};
	}
	return null;
}
function isInCheck(board, owner) {
	const king = findKing(board, owner);
	if (!king) return false;
	return isSquareAttacked(board, king, otherOwner(owner));
}
function canPromote(piece) {
	return !piece.promoted && piece.kind !== "king" && piece.kind !== "gold";
}
function inPromotionZone(owner, row) {
	return owner === "sente" ? row <= 2 : row >= 6;
}
/** Filas en las que una pieza sin promocionar ya no tendría movimientos. */
function isDeadEndRow(kind, owner, row) {
	const distance = owner === "sente" ? row : 8 - row;
	if (kind === "pawn" || kind === "lance") return distance === 0;
	if (kind === "knight") return distance <= 1;
	return false;
}
function promotionOptions(piece, from, to) {
	const possible = canPromote(piece) && (inPromotionZone(piece.owner, from.row) || inPromotionZone(piece.owner, to.row));
	return {
		canPromote: possible,
		mustPromote: possible && isDeadEndRow(piece.kind, piece.owner, to.row)
	};
}
function hasUnpromotedPawnOnFile(board, owner, col) {
	for (let row = 0; row < 9; row++) {
		const piece = board[row][col];
		if (piece?.owner === owner && piece.kind === "pawn" && !piece.promoted) return true;
	}
	return false;
}
/** Aplica un movimiento sin comprobar su legalidad. */
function applyMove(position, move) {
	const next = clonePosition(position);
	const owner = position.turn;
	if (move.type === "drop") {
		next.board[move.to.row][move.to.col] = {
			kind: move.piece,
			owner
		};
		next.hands[owner][move.piece] -= 1;
	} else {
		const piece = next.board[move.from.row][move.from.col];
		if (!piece) throw new Error("No hay pieza en la casilla de origen.");
		const captured = next.board[move.to.row][move.to.col];
		if (captured && captured.kind !== "king") next.hands[owner][captured.kind] += 1;
		next.board[move.from.row][move.from.col] = null;
		next.board[move.to.row][move.to.col] = move.promote ? {
			...piece,
			promoted: true
		} : piece;
	}
	next.turn = otherOwner(owner);
	return next;
}
/** Movimientos de tablero que respetan el patrón de la pieza (pueden dejar al rey en jaque). */
function pseudoBoardMoves(position, from) {
	const piece = position.board[from.row][from.col];
	if (!piece || piece.owner !== position.turn) return [];
	const moves = [];
	for (const to of attackedSquares(position.board, from)) {
		if (position.board[to.row][to.col]?.owner === piece.owner) continue;
		const { canPromote: may, mustPromote: must } = promotionOptions(piece, from, to);
		if (may) moves.push({
			type: "move",
			from,
			to,
			promote: true
		});
		if (!must) moves.push({
			type: "move",
			from,
			to,
			promote: false
		});
	}
	return moves;
}
/**
* Comprueba si el movimiento deja al propio rey a salvo. Modifica el tablero
* temporalmente y lo restaura antes de volver (evita copiar la posición).
*/
function leavesKingSafe(position, move) {
	const board = position.board;
	const owner = position.turn;
	const to = board[move.to.row][move.to.col];
	if (move.type === "drop") {
		board[move.to.row][move.to.col] = {
			kind: move.piece,
			owner
		};
		const safe = !isInCheck(board, owner);
		board[move.to.row][move.to.col] = to;
		return safe;
	}
	const from = board[move.from.row][move.from.col];
	board[move.to.row][move.to.col] = from;
	board[move.from.row][move.from.col] = null;
	const safe = !isInCheck(board, owner);
	board[move.from.row][move.from.col] = from;
	board[move.to.row][move.to.col] = to;
	return safe;
}
function legalMovesFrom(position, from) {
	return pseudoBoardMoves(position, from).filter((move) => leavesKingSafe(position, move));
}
function dropRestriction(position, kind, to) {
	const owner = position.turn;
	if (position.hands[owner][kind] <= 0) return "no-piece";
	if (position.board[to.row][to.col] !== null) return "occupied";
	if (isDeadEndRow(kind, owner, to.row)) return "dead-end";
	if (kind === "pawn" && hasUnpromotedPawnOnFile(position.board, owner, to.col)) return "nifu";
	return null;
}
/**
* Uchifuzume: está prohibido dar jaque mate colocando un peón desde la mano.
*
* Un jaque de peón colocado no se puede tapar (el peón está pegado al rey)
* ni puede ser doble, así que basta con mirar si el rival tiene alguna
* jugada de tablero (capturar el peón o huir con el rey).
*/
function isPawnDropMate(position, to) {
	const next = applyMove(position, {
		type: "drop",
		piece: "pawn",
		to
	});
	if (!isInCheck(next.board, next.turn)) return false;
	for (let row = 0; row < 9; row++) for (let col = 0; col < 9; col++) if (next.board[row][col]?.owner === next.turn && legalMovesFrom(next, {
		row,
		col
	}).length > 0) return false;
	return true;
}
function isLegalDrop(position, kind, to, inCheck) {
	if (dropRestriction(position, kind, to) !== null) return false;
	if (inCheck && !leavesKingSafe(position, {
		type: "drop",
		piece: kind,
		to
	})) return false;
	if (kind === "pawn" && isPawnDropMate(position, to)) return false;
	return true;
}
function legalDrops(position, kind) {
	const inCheck = isInCheck(position.board, position.turn);
	const squares = [];
	if (position.hands[position.turn][kind] <= 0) return squares;
	for (let row = 0; row < 9; row++) for (let col = 0; col < 9; col++) {
		const to = {
			row,
			col
		};
		if (isLegalDrop(position, kind, to, inCheck)) squares.push(to);
	}
	return squares;
}
function generateLegalMoves(position) {
	const moves = [];
	for (let row = 0; row < 9; row++) for (let col = 0; col < 9; col++) if (position.board[row][col]?.owner === position.turn) moves.push(...legalMovesFrom(position, {
		row,
		col
	}));
	for (const kind of HAND_ORDER) for (const to of legalDrops(position, kind)) moves.push({
		type: "drop",
		piece: kind,
		to
	});
	return moves;
}
function hasAnyLegalMove(position) {
	for (let row = 0; row < 9; row++) for (let col = 0; col < 9; col++) {
		if (position.board[row][col]?.owner !== position.turn) continue;
		if (legalMovesFrom(position, {
			row,
			col
		}).length > 0) return true;
	}
	const inCheck = isInCheck(position.board, position.turn);
	for (const kind of HAND_ORDER) {
		if (position.hands[position.turn][kind] <= 0) continue;
		for (let row = 0; row < 9; row++) for (let col = 0; col < 9; col++) if (isLegalDrop(position, kind, {
			row,
			col
		}, inCheck)) return true;
	}
	return false;
}
function movesEqual(a, b) {
	if (a.type !== b.type || !sameSquare(a.to, b.to)) return false;
	if (a.type === "drop" && b.type === "drop") return a.piece === b.piece;
	if (a.type === "move" && b.type === "move") return sameSquare(a.from, b.from) && a.promote === b.promote;
	return false;
}
/** Clave única de una posición para detectar repeticiones (sennichite). */
function positionKey(position) {
	let key = "";
	for (const row of position.board) {
		for (const piece of row) if (!piece) key += ".";
		else {
			const letter = PIECE_LETTERS[piece.kind];
			key += (piece.promoted ? "+" : "") + (piece.owner === "sente" ? letter : letter.toLowerCase());
		}
		key += "/";
	}
	for (const owner of ["sente", "gote"]) {
		for (const kind of HAND_ORDER) key += position.hands[owner][kind];
		key += "|";
	}
	return key + position.turn;
}
const PIECE_LETTERS = {
	king: "K",
	rook: "R",
	bishop: "B",
	gold: "G",
	silver: "S",
	knight: "N",
	lance: "L",
	pawn: "P"
};
// packages/engine/src/game.ts
function newGame(start = createInitialPosition()) {
	const state = {
		start,
		position: start,
		history: [],
		keys: [positionKey(start)],
		result: null
	};
	return {
		...state,
		result: evaluateResult(state)
	};
}
function playMove(state, move) {
	if (state.result) throw new Error("La partida ya ha terminado.");
	if (!generateLegalMoves(state.position).some((candidate) => movesEqual(candidate, move))) throw new Error("Movimiento ilegal.");
	const before = state.position;
	const position = applyMove(before, move);
	const capturedPiece = move.type === "move" ? before.board[move.to.row][move.to.col] : null;
	const entry = {
		move,
		before,
		givesCheck: isInCheck(position.board, position.turn),
		captured: capturedPiece ? capturedPiece.kind : null
	};
	const next = {
		start: state.start,
		position,
		history: [...state.history, entry],
		keys: [...state.keys, positionKey(position)],
		result: null
	};
	return {
		...next,
		result: evaluateResult(next)
	};
}
function evaluateResult(state) {
	const { position } = state;
	if (!hasAnyLegalMove(position)) return {
		winner: otherOwner(position.turn),
		reason: isInCheck(position.board, position.turn) ? "checkmate" : "no-moves"
	};
	return detectSennichite(state);
}
/**
* Sennichite: si la misma posición aparece cuatro veces, la partida es
* tablas, salvo que uno de los bandos haya dado jaque en todas sus
* jugadas del ciclo; en ese caso, ese bando pierde.
*/
function detectSennichite(state) {
	const current = state.keys[state.keys.length - 1];
	const occurrences = [];
	state.keys.forEach((key, index) => {
		if (key === current) occurrences.push(index);
	});
	if (occurrences.length < 4) return null;
	const firstIndex = occurrences[0];
	const cycle = state.history.slice(firstIndex);
	for (const owner of ["sente", "gote"]) {
		const ownMoves = cycle.filter((entry) => entry.before.turn === owner);
		if (ownMoves.length > 0 && ownMoves.every((entry) => entry.givesCheck)) return {
			winner: otherOwner(owner),
			reason: "perpetual-check"
		};
	}
	return {
		winner: null,
		reason: "repetition"
	};
}
// packages/engine/src/notation.ts
const USI_PIECES = {
	R: "rook",
	B: "bishop",
	G: "gold",
	S: "silver",
	N: "knight",
	L: "lance",
	P: "pawn"
};
function usiSquare(text) {
	const file = Number(text[0]);
	const row = text.charCodeAt(1) - 97;
	if (!Number.isInteger(file) || file < 1 || file > 9 || row < 0 || row > 8) return null;
	return {
		row,
		col: 9 - file
	};
}
/** Convierte un movimiento USI (7g7f, 8h2b+, P*5e) en un movimiento. No comprueba legalidad. */
function fromUsi(text) {
	const trimmed = text.trim();
	if (trimmed[1] === "*") {
		const piece = USI_PIECES[trimmed[0]];
		const to = usiSquare(trimmed.slice(2, 4));
		return piece && to ? {
			type: "drop",
			piece,
			to
		} : null;
	}
	const from = usiSquare(trimmed.slice(0, 2));
	const to = usiSquare(trimmed.slice(2, 4));
	if (!from || !to) return null;
	return {
		type: "move",
		from,
		to,
		promote: trimmed[4] === "+"
	};
}
const LETTER_KIND = Object.fromEntries(Object.entries({
	king: "k",
	rook: "r",
	bishop: "b",
	gold: "g",
	silver: "s",
	knight: "n",
	lance: "l",
	pawn: "p"
}).map(([kind, letter]) => [letter, kind]));
/** Lee una posición SFEN. Lanza un error si el texto no es válido. */
function fromSfen(sfen) {
	const parts = sfen.trim().replace(/^sfen\s+/, "").split(/\s+/);
	if (parts.length < 3) throw new Error("SFEN incompleto: se esperan tablero, turno y manos.");
	const [boardText, turnText, handText] = parts;
	const rows = boardText.split("/");
	if (rows.length !== 9) throw new Error("El tablero SFEN debe tener 9 filas.");
	const board = emptyBoard();
	rows.forEach((rowText, row) => {
		let col = 0;
		let promoted = false;
		for (const char of rowText) {
			if (char === "+") {
				promoted = true;
				continue;
			}
			if (/[1-9]/.test(char)) {
				col += Number(char);
				continue;
			}
			const kind = LETTER_KIND[char.toLowerCase()];
			if (!kind || col >= 9) throw new Error(`Carácter no válido en la fila ${row + 1}: ${char}`);
			const piece = {
				kind,
				owner: char === char.toUpperCase() ? "sente" : "gote"
			};
			if (promoted) piece.promoted = true;
			board[row][col++] = piece;
			promoted = false;
		}
		if (col !== 9) throw new Error(`La fila ${row + 1} no tiene 9 casillas.`);
	});
	if (turnText !== "b" && turnText !== "w") throw new Error("El turno debe ser \"b\" (Sente) o \"w\" (Gote).");
	const hands = emptyHands();
	if (handText !== "-") {
		const pattern = /(\d*)([RBGSNLPrbgsnlp])/g;
		let match;
		let consumed = 0;
		while ((match = pattern.exec(handText)) !== null) {
			const owner = match[2] === match[2].toUpperCase() ? "sente" : "gote";
			const kind = LETTER_KIND[match[2].toLowerCase()];
			hands[owner][kind] += match[1] ? Number(match[1]) : 1;
			consumed += match[0].length;
		}
		if (consumed !== handText.length) throw new Error("Las piezas en mano no son válidas.");
	}
	return {
		board,
		hands,
		turn: turnText === "b" ? "sente" : "gote"
	};
}
/** Reconstruye una partida a partir de SFEN y movimientos USI (comprueba la legalidad). */
function deserializeGame(saved) {
	let state = newGame(fromSfen(saved.sfen));
	for (const text of saved.moves) {
		const move = fromUsi(text);
		if (!move) throw new Error(`Movimiento USI no válido: ${text}`);
		state = playMove(state, move);
	}
	return state;
}
// packages/engine/src/online.ts
/**
* Valida una jugada de una partida en línea con las reglas completas del motor.
* La usa el servidor (Edge Function de Supabase) antes de guardar nada.
*
* @param ply número de jugadas que el cliente cree que hay (evita jugadas
*   duplicadas o desfasadas si dos peticiones llegan a la vez).
*/
function validateOnlineMove(game, userId, usi, ply) {
	const side = game.sente_id === userId ? "sente" : game.gote_id === userId ? "gote" : null;
	if (!side) return {
		ok: false,
		status: 403,
		error: "No juegas esta partida."
	};
	if (game.status === "waiting") return {
		ok: false,
		status: 409,
		error: "Todavía no ha llegado tu rival."
	};
	if (game.status !== "active") return {
		ok: false,
		status: 409,
		error: "La partida ya ha terminado."
	};
	if (ply !== game.moves.length) return {
		ok: false,
		status: 409,
		error: "La partida ha cambiado: actualiza el tablero."
	};
	let state;
	try {
		state = deserializeGame({
			sfen: game.start_sfen,
			moves: game.moves
		});
	} catch {
		return {
			ok: false,
			status: 500,
			error: "La partida guardada no es válida."
		};
	}
	if (state.position.turn !== side) return {
		ok: false,
		status: 409,
		error: "No es tu turno."
	};
	const move = typeof usi === "string" && /^[1-9][a-i][1-9][a-i]\+?$|^[RBGSNLP]\*[1-9][a-i]$/.test(usi) ? fromUsi(usi) : null;
	if (!move) return {
		ok: false,
		status: 422,
		error: "Jugada mal escrita."
	};
	try {
		const next = playMove(state, move);
		return {
			ok: true,
			moves: [...game.moves, usi],
			status: next.result ? "finished" : "active",
			winner: next.result?.winner ?? null,
			reason: next.result?.reason ?? null
		};
	} catch {
		return {
			ok: false,
			status: 422,
			error: "Jugada ilegal."
		};
	}
}
// supabase/functions/online-move/handler.ts
const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
	"Access-Control-Allow-Methods": "POST, OPTIONS"
};
function json(body, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			...corsHeaders,
			"Content-Type": "application/json"
		}
	});
}
/**
* Recibe { code, move, ply } de un jugador, valida la jugada con el motor de
* reglas y la guarda. Los dos jugadores la reciben al momento por Realtime.
*/
async function handleOnlineMove(request, deps) {
	if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
	if (request.method !== "POST") return json({ error: "Método no permitido." }, 405);
	const token = (request.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
	const user = token ? await deps.userFromToken(token) : null;
	if (!user) return json({ error: "Hay que iniciar sesión." }, 401);
	let body;
	try {
		body = await request.json();
	} catch {
		return json({ error: "Petición no válida." }, 400);
	}
	const { code, move, ply } = body;
	if (typeof code !== "string" || typeof move !== "string" || typeof ply !== "number" || !Number.isInteger(ply)) return json({ error: "Faltan datos: code, move y ply." }, 400);
	const game = await deps.findGame(code.trim().toUpperCase());
	if (!game) return json({ error: "Partida no encontrada." }, 404);
	const outcome = validateOnlineMove(game, user.id, move, ply);
	if (!outcome.ok) return json({ error: outcome.error }, outcome.status);
	const saved = await deps.saveIfUnchanged(game, {
		moves: outcome.moves,
		status: outcome.status,
		winner: outcome.winner,
		reason: outcome.reason
	});
	if (!saved) return json({ error: "La partida ha cambiado: actualiza el tablero." }, 409);
	return json(saved);
}
// supabase/functions/online-move/main.ts
const admin = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), { auth: {
	persistSession: false,
	autoRefreshToken: false
} });
Deno.serve((request) => handleOnlineMove(request, {
	async userFromToken(token) {
		const { data, error } = await admin.auth.getUser(token);
		return error || !data.user ? null : { id: data.user.id };
	},
	async findGame(code) {
		const { data } = await admin.from("online_games").select("*").eq("code", code).maybeSingle();
		return data ?? null;
	},
	async saveIfUnchanged(game, update) {
		const { data } = await admin.from("online_games").update({
			...update,
			updated_at: (/* @__PURE__ */ new Date()).toISOString()
		}).eq("id", game.id).eq("status", "active").eq("moves", `{${game.moves.join(",")}}`).select().maybeSingle();
		return data ?? null;
	}
}));
