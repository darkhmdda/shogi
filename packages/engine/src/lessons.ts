import { applyMove, generateLegalMoves, isInCheck, sameSquare } from './rules'
import type { HandKind, Move, PieceKind, Position, Square } from './types'

/** Casilla en notación USI: columna 1-9 y fila a-i (7g = 7七). */
export function parseSquare(text: string): Square {
  const file = Number(text[0])
  const row = text.charCodeAt(1) - 97
  if (!(file >= 1 && file <= 9 && row >= 0 && row <= 8)) throw new Error(`Casilla no válida: ${text}`)
  return { row, col: 9 - file }
}

export type LessonGoal =
  | { type: 'move'; from: string; to: string[] }
  | { type: 'capture'; piece?: PieceKind }
  | { type: 'drop'; piece?: HandKind }
  | { type: 'promote' }
  | { type: 'check' }
  | { type: 'mate' }
  | { type: 'any' }

export type LessonStep = {
  instruction: string
  sfen: string
  goal: LessonGoal
  hint: string
  success: string
}

export type Lesson = {
  id: string
  title: string
  kanji: string
  summary: string
  steps: LessonStep[]
}

export function goalSatisfied(goal: LessonGoal, before: Position, move: Move): boolean {
  const after = applyMove(before, move)

  switch (goal.type) {
    case 'move':
      return (
        move.type === 'move' &&
        sameSquare(move.from, parseSquare(goal.from)) &&
        goal.to.some((to) => sameSquare(move.to, parseSquare(to)))
      )
    case 'capture': {
      if (move.type !== 'move') return false
      const captured = before.board[move.to.row][move.to.col]
      return captured !== null && (!goal.piece || captured.kind === goal.piece)
    }
    case 'drop':
      return move.type === 'drop' && (!goal.piece || move.piece === goal.piece)
    case 'promote':
      return move.type === 'move' && move.promote
    case 'check':
      return isInCheck(after.board, after.turn)
    case 'mate':
      return isInCheck(after.board, after.turn) && generateLegalMoves(after).length === 0
    case 'any':
      return true
  }
}

export const LESSONS: Lesson[] = [
  {
    id: 'first-steps',
    title: 'Primeros pasos',
    kanji: '歩',
    summary: 'El peón, las coordenadas y la primera captura.',
    steps: [
      {
        instruction:
          'Sente (azul) siempre empieza. Avanza el peón de 7七 a 7六: es la apertura más popular porque abre la diagonal del alfil.',
        sfen: 'lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1',
        goal: { type: 'move', from: '7g', to: ['7f'] },
        hint: 'Las columnas se numeran de 9 (izquierda) a 1 (derecha); las filas, de 一 (arriba) a 九 (abajo). Busca la columna 7, fila 七.',
        success: '¡Bien! Ahora el alfil de 8八 ve toda la diagonal.',
      },
      {
        instruction: 'El peón captura igual que se mueve: una casilla hacia delante. Captura el peón rival de 5四.',
        sfen: '4k4/9/9/4p4/4P4/9/9/9/4K4 b - 1',
        goal: { type: 'capture', piece: 'pawn' },
        hint: 'Selecciona tu peón de 5五 y pulsa sobre el peón rojo que tiene delante.',
        success: 'Capturado. Fíjate: el peón ha pasado a tu mano.',
      },
    ],
  },
  {
    id: 'long-range',
    title: 'Torre y alfil',
    kanji: '飛',
    summary: 'Las piezas de largo alcance.',
    steps: [
      {
        instruction: 'La torre se desliza en línea recta tantas casillas como quiera. Captura el oro de 2五.',
        sfen: '4k4/9/9/9/1R5g1/9/9/9/4K4 b - 1',
        goal: { type: 'capture', piece: 'gold' },
        hint: 'La torre está en 8五, en la misma fila que el oro.',
        success: 'Exacto: la torre recorre toda la fila de una vez.',
      },
      {
        instruction: 'El alfil se mueve en diagonal. Captura la plata de 3三.',
        sfen: '4k4/9/6s2/9/9/9/2B6/9/4K4 b - 1',
        goal: { type: 'capture', piece: 'silver' },
        hint: 'Desde 7七, la diagonal hacia arriba a la derecha pasa por 6六, 5五 y 4四.',
        success: 'Muy bien. Has entrado en la zona de promoción: puedes elegir promocionar.',
      },
    ],
  },
  {
    id: 'generals',
    title: 'Los generales',
    kanji: '金',
    summary: 'Oro y plata: defensa y ataque.',
    steps: [
      {
        instruction: 'El oro puede moverse a los lados. Mueve el oro de 5七 a 4七 o a 6七.',
        sfen: '4k4/9/9/9/9/9/4G4/9/4K4 b - 1',
        goal: { type: 'move', from: '5g', to: ['4g', '6g'] },
        hint: 'Las casillas posibles se marcan con un punto al seleccionar el oro.',
        success: 'Correcto. El oro va a todas partes menos a las diagonales de atrás.',
      },
      {
        instruction: 'La plata sí puede retroceder en diagonal. Captura el peón de 6八.',
        sfen: '4k4/9/9/9/9/9/4S4/3p5/4K4 b - 1',
        goal: { type: 'capture', piece: 'pawn' },
        hint: 'Selecciona la plata de 5七 y mira las diagonales hacia abajo.',
        success: '¡Perfecto! La plata es ideal para atacar y retirarse.',
      },
    ],
  },
  {
    id: 'knight-lance',
    title: 'Caballo y lanza',
    kanji: '桂',
    summary: 'El salto del caballo y la carrera de la lanza.',
    steps: [
      {
        instruction: 'El caballo salta dos casillas hacia delante y una a un lado, por encima de otras piezas. Captura el peón de 7五.',
        sfen: '4k4/9/9/9/2p6/9/1NP6/9/4K4 b - 1',
        goal: { type: 'capture', piece: 'pawn' },
        hint: 'El caballo está en 8七.',
        success: '¡Salto perfecto!',
      },
      {
        instruction: 'La lanza avanza en línea recta, sin retroceder nunca. Captura la plata de 9三.',
        sfen: '4k4/9/s8/9/9/9/9/9/L3K4 b - 1',
        goal: { type: 'capture', piece: 'silver' },
        hint: 'La lanza está en 9九, en la misma columna.',
        success: 'Muy bien. La lanza es muy fuerte en columnas abiertas.',
      },
    ],
  },
  {
    id: 'hand',
    title: 'Capturas y la mano',
    kanji: '持',
    summary: 'La regla que hace único al shōgi.',
    steps: [
      {
        instruction: 'Captura el oro rival con tu torre. La pieza no desaparece: pasa a tu mano.',
        sfen: '4k4/9/9/9/4g4/4R4/9/9/4K4 b - 1',
        goal: { type: 'capture', piece: 'gold' },
        hint: 'La torre de 5六 tiene el oro justo delante.',
        success: 'El oro ya es tuyo: aparece en tu mano, debajo del tablero.',
      },
      {
        instruction: 'En lugar de mover, puedes colocar una pieza de tu mano en cualquier casilla vacía. Coloca el oro.',
        sfen: '4k4/9/9/9/9/9/9/9/4K4 b G 1',
        goal: { type: 'drop', piece: 'gold' },
        hint: 'Pulsa el oro de tu mano y después una casilla vacía.',
        success: '¡Así se colocan las piezas! Esto cuenta como tu jugada del turno.',
      },
    ],
  },
  {
    id: 'promotion',
    title: 'Promoción',
    kanji: '成',
    summary: 'La zona de promoción y las piezas mejoradas.',
    steps: [
      {
        instruction: 'Las tres últimas filas son la zona de promoción. Lleva la plata de 7四 a la zona y promociónala.',
        sfen: '4k4/9/9/2S6/9/9/9/9/4K4 b - 1',
        goal: { type: 'promote' },
        hint: 'Mueve la plata a la fila 三 y elige "Promocionar".',
        success: 'La plata promocionada (全) se mueve como un oro.',
      },
      {
        instruction: 'Un peón que llega a la última fila debe promocionar: si no, no podría volver a moverse. Avanza el peón de 1二.',
        sfen: '4k4/8P/9/9/9/9/9/9/4K4 b - 1',
        goal: { type: 'promote' },
        hint: 'Aquí la promoción es obligatoria; se hace sola.',
        success: '¡Tokin (と)! Un simple peón que ahora se mueve como un oro.',
      },
    ],
  },
  {
    id: 'check',
    title: 'Jaque',
    kanji: '王',
    summary: 'Atacar al rey y defenderse.',
    steps: [
      {
        instruction: 'Da jaque al rey rojo: ataca su casilla con alguna de tus piezas.',
        sfen: '4k4/9/9/9/9/9/9/9/R3K4 b - 1',
        goal: { type: 'check' },
        hint: 'La torre puede subir por la columna 9 y atacar la fila 一, o ponerse en la columna 5.',
        success: '¡Jaque! El rival está obligado a responder.',
      },
      {
        instruction: 'Ahora tu rey está en jaque: la torre roja ataca la columna 5. Sal del jaque.',
        sfen: 'k3r4/9/9/9/9/9/9/9/4K4 b - 1',
        goal: { type: 'any' },
        hint: 'Solo verás destinos legales: mueve el rey fuera de la columna 5.',
        success: 'A salvo. Nunca puedes dejar a tu rey en jaque.',
      },
    ],
  },
  {
    id: 'mate',
    title: 'Jaque mate',
    kanji: '詰',
    summary: 'Cómo se gana una partida.',
    steps: [
      {
        instruction: 'Da jaque mate en una jugada usando el oro de tu mano.',
        sfen: '4k4/9/4P4/9/9/9/9/9/4K4 b G 1',
        goal: { type: 'mate' },
        hint: 'Coloca el oro justo delante del rey, donde tu peón lo protege. Se llama "oro en la cabeza" (頭金).',
        success: '¡Jaque mate! El rey no puede escapar ni capturar el oro.',
      },
      {
        instruction: 'Otro mate en una con el oro: ahora el rey está en la esquina.',
        sfen: '6snk/9/6G1P/9/9/9/9/9/4K4 b G 1',
        goal: { type: 'mate' },
        hint: 'Busca una casilla junto al rey protegida por tu peón de 1三.',
        success: '¡Mate! Los defensores del propio rey le quitan las casillas de escape.',
      },
    ],
  },
  {
    id: 'special-rules',
    title: 'Reglas especiales',
    kanji: '禁',
    summary: 'Nifu y uchifuzume.',
    steps: [
      {
        instruction: 'Coloca el peón de tu mano. Recuerda el nifu: no puedes tener dos peones sin promocionar en la misma columna.',
        sfen: '4k4/9/9/9/9/9/4P4/9/4K4 b P 1',
        goal: { type: 'drop', piece: 'pawn' },
        hint: 'Cualquier columna salvo la 5. Prueba primero en la 5 para ver el aviso.',
        success: 'Correcto. El nifu es la falta más común entre principiantes.',
      },
      {
        instruction: 'Colocar un peón que dé mate está prohibido (uchifuzume). Da mate de otra manera.',
        sfen: 'k8/2S6/G8/9/9/9/9/9/8K b GP 1',
        goal: { type: 'mate' },
        hint: 'El peón en 9二 sería mate prohibido; el oro en la misma casilla, no.',
        success: '¡Mate legal! Mover un peón del tablero para dar mate sí está permitido; solo se prohíbe colocarlo desde la mano.',
      },
    ],
  },
]
