import { giveRemainingToDefender } from './mate'
import { fromSfen } from './record'
import type { Position } from './types'

export type Tsume = {
  id: string
  /** Número de medias jugadas del mate (1 o 3). */
  plies: 1 | 3
  title: string
  hint: string
  /** Posición del atacante (Sente). El resto de piezas va a la mano del defensor. */
  sfen: string
}

export const TSUME: Tsume[] = [
  { id: 'm1-atama-kin', plies: 1, title: 'Oro en la cabeza', sfen: '4k4/9/4P4/9/9/9/9/9/9 b G 1', hint: 'El oro protegido justo delante del rey es el mate más clásico.' },
  { id: 'm1-koshi-kin', plies: 1, title: 'Oro en la esquina', sfen: '6snk/9/6G1P/9/9/9/9/9/9 b G 1', hint: 'Las piezas del propio rey le quitan las casillas de escape.' },
  { id: 'm1-silver', plies: 1, title: 'La plata decisiva', sfen: '3k5/2p6/3G5/9/9/9/9/9/9 b BS 1', hint: 'La plata ataca en diagonal hacia delante.' },
  { id: 'm1-bishop-drop', plies: 1, title: 'Alfil desde la mano', sfen: '8k/6B1s/7S1/9/9/9/9/9/9 b B 1', hint: 'Una pieza de largo alcance colocada pegada al rey no se puede tapar.' },
  { id: 'm1-rook-drop', plies: 1, title: 'Torre en la fila de fondo', sfen: '4k4/4lgL2/3L5/9/9/9/9/9/9 b RG 1', hint: 'El rey está encerrado por sus propias piezas.' },
  { id: 'm1-knight', plies: 1, title: 'El salto del caballo', sfen: '7nk/7nn/9/8+N/9/9/9/9/9 b NL 1', hint: 'El jaque de caballo no se puede tapar.' },
  { id: 'm1-pawn-push', plies: 1, title: 'Mate con peón (legal)', sfen: '5kl2/9/4P4/5N3/9/9/9/9/9 b SL 1', hint: 'Colocar un peón que dé mate está prohibido, pero moverlo sí está permitido.' },
  { id: 'm1-horse', plies: 1, title: 'El caballo dragón', sfen: 'k8/sb7/1B7/2+B6/9/9/9/9/9 b P 1', hint: 'Capturar y promocionar a la vez puede ser mate.' },
  { id: 'm1-gold-move', plies: 1, title: 'Un paso del oro', sfen: '8k/8s/7G1/6B2/9/9/9/9/9 b RN 1', hint: 'No siempre hay que colocar: a veces basta con mover.' },
  { id: 'm3-rook', plies: 3, title: 'Torre que persigue', sfen: '5k3/4p4/5G3/9/9/9/9/9/9 b R 1', hint: 'Empieza colocando la torre pegada al rey.' },
  { id: 'm3-two-golds', plies: 3, title: 'Dos oros', sfen: '9/k8/b8/G8/2L6/9/9/9/9 b 2G 1', hint: 'Un oro empuja al rey hacia la esquina y el otro termina el trabajo.' },
  { id: 'm3-silver-sacrifice', plies: 3, title: 'Sacrificio de plata', sfen: '6gks/6g2/7SG/9/9/9/9/9/9 b S 1', hint: 'A veces hay que entregar una pieza para atraer al rey.' },
  { id: 'm3-silver-lance', plies: 3, title: 'Plata y lanza', sfen: '9/k8/l1G6/9/9/9/9/9/9 b SL 1', hint: 'La plata da jaque desde una casilla que el rey no puede tomar.' },
  { id: 'm3-knight', plies: 3, title: 'Caballo y alfil', sfen: '3bk4/4r4/4B4/5+N3/9/9/9/9/9 b SN 1', hint: 'El caballo obliga al rey a moverse; después decide el alfil.' },
  { id: 'm3-gold-back', plies: 3, title: 'Oro por detrás', sfen: '2k6/3r5/3+B+L4/9/9/9/9/9/9 b GS 1', hint: 'Coloca el oro en la fila de fondo.' },
]

export function tsumePosition(tsume: Tsume): Position {
  return giveRemainingToDefender(fromSfen(tsume.sfen))
}
