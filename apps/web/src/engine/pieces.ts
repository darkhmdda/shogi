import type { Owner, Piece, PieceKind } from './types'

export const PIECE_KANJI: Record<PieceKind, string> = {
  king: '玉',
  rook: '飛',
  bishop: '角',
  gold: '金',
  silver: '銀',
  knight: '桂',
  lance: '香',
  pawn: '歩',
}

export const PROMOTED_KANJI: Partial<Record<PieceKind, string>> = {
  rook: '龍',
  bishop: '馬',
  silver: '全',
  knight: '圭',
  lance: '杏',
  pawn: 'と',
}

export const PIECE_NAMES: Record<PieceKind, string> = {
  king: 'rey',
  rook: 'torre',
  bishop: 'alfil',
  gold: 'general de oro',
  silver: 'general de plata',
  knight: 'caballo',
  lance: 'lanza',
  pawn: 'peón',
}

export const PROMOTED_NAMES: Partial<Record<PieceKind, string>> = {
  rook: 'dragón',
  bishop: 'caballo dragón',
  silver: 'plata promocionada',
  knight: 'caballo promocionado',
  lance: 'lanza promocionada',
  pawn: 'tokin',
}

export const JAPANESE_NAMES: Record<PieceKind, string> = {
  king: 'gyokushō / ōshō',
  rook: 'hisha',
  bishop: 'kakugyō',
  gold: 'kinshō',
  silver: 'ginshō',
  knight: 'keima',
  lance: 'kyōsha',
  pawn: 'fuhyō',
}

export const PIECE_MOVEMENT: Record<PieceKind, string> = {
  king: 'Una casilla en cualquier dirección. Si no puede escapar del jaque, la partida termina.',
  rook: 'Cualquier número de casillas en línea recta, en horizontal o vertical.',
  bishop: 'Cualquier número de casillas en diagonal.',
  gold: 'Una casilla hacia delante, en diagonal hacia delante, a los lados o hacia atrás. No puede retroceder en diagonal. No promociona.',
  silver: 'Una casilla hacia delante o en cualquiera de las cuatro diagonales. No puede ir a los lados ni recto hacia atrás.',
  knight: 'Salta dos casillas hacia delante y una a un lado. Es la única pieza que salta y solo avanza.',
  lance: 'Cualquier número de casillas recto hacia delante. Nunca retrocede.',
  pawn: 'Una casilla recto hacia delante. Captura igual que se mueve.',
}

export const PROMOTED_MOVEMENT: Partial<Record<PieceKind, string>> = {
  rook: 'Como la torre, y además una casilla en diagonal.',
  bishop: 'Como el alfil, y además una casilla en horizontal o vertical.',
  silver: 'Se mueve como el general de oro.',
  knight: 'Se mueve como el general de oro.',
  lance: 'Se mueve como el general de oro.',
  pawn: 'Se mueve como el general de oro.',
}

export const PIECE_TIPS: Record<PieceKind, string> = {
  king: 'Rodéalo de generales de oro y plata: un castillo sólido gana partidas.',
  rook: 'La pieza más poderosa. Promocionada en dragón es temible.',
  bishop: 'Controla diagonales largas. Cuidado con los intercambios tempranos.',
  gold: 'El mejor defensor del rey. Como no promociona, mantiene siempre su forma.',
  silver: 'Ideal para atacar: avanza y retrocede en diagonal con facilidad.',
  knight: 'Puede quedar atrapado con facilidad porque no retrocede.',
  lance: 'Muy fuerte colocada desde la mano en el fondo de una columna abierta.',
  pawn: 'No puedes tener dos peones sin promocionar en la misma columna (nifu).',
}

export function pieceKanji(piece: Piece): string {
  if (piece.kind === 'king') return piece.owner === 'gote' ? '王' : '玉'
  if (piece.promoted) return PROMOTED_KANJI[piece.kind] ?? PIECE_KANJI[piece.kind]
  return PIECE_KANJI[piece.kind]
}

export function pieceName(piece: Pick<Piece, 'kind' | 'promoted'>): string {
  if (piece.promoted) return PROMOTED_NAMES[piece.kind] ?? PIECE_NAMES[piece.kind]
  return PIECE_NAMES[piece.kind]
}

export function pieceMovement(piece: Pick<Piece, 'kind' | 'promoted'>): string {
  if (piece.promoted) return PROMOTED_MOVEMENT[piece.kind] ?? PIECE_MOVEMENT[piece.kind]
  return PIECE_MOVEMENT[piece.kind]
}

export const OWNER_LABEL: Record<Owner, string> = {
  sente: 'Sente (azul)',
  gote: 'Gote (rojo)',
}

export const OWNER_SHORT: Record<Owner, string> = {
  sente: 'Sente',
  gote: 'Gote',
}
