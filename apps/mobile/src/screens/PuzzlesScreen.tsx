import {
  applyMove,
  defenderReply,
  formatMove,
  generateLegalMoves,
  isInCheck,
  solveMate,
  TSUME,
  tsumePosition,
  type Move,
  type Position,
  type Tsume,
} from '@shogi/engine'
import { useMoveInput } from '@shogi/react'
import { useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Board, PromotionPanel } from '../components/Board'
import { Button, Card, Feedback, Row } from '../components/ui'
import { completePuzzle, useProgress } from '../progress'
import { colors, spacing } from '../theme'

type Status = 'playing' | 'waiting' | 'solved' | 'failed'

type State = { id: string; position: Position; played: number; lastMove?: Move; status: Status; moves: string[] }

const start = (tsume: Tsume): State => ({ id: tsume.id, position: tsumePosition(tsume), played: 0, status: 'playing', moves: [] })

export function PuzzlesScreen() {
  const progress = useProgress()
  const [state, setState] = useState<State>(() => start(TSUME.find((t) => !progress.puzzles[t.id]) ?? TSUME[0]))
  const [message, setMessage] = useState<string | null>(null)
  const [extra, setExtra] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const tsume = TSUME.find((t) => t.id === state.id)!
  const index = TSUME.indexOf(tsume)
  const solved = TSUME.filter((t) => progress.puzzles[t.id]).length

  const input = useMoveInput(state.position, {
    enabled: state.status === 'playing',
    onMove: handleMove,
    onMessage: setMessage,
  })

  function handleMove(move: Move) {
    const before = state.position
    const after = applyMove(before, move)
    if (!isInCheck(after.board, after.turn)) {
      setMessage('En tsume cada jugada tuya debe dar jaque.')
      return
    }

    const moves = [...state.moves, formatMove(before, move, state.lastMove?.to ?? null)]
    const played = state.played + 1

    if (generateLegalMoves(after).length === 0) {
      setState({ ...state, position: after, played, lastMove: move, status: 'solved', moves })
      setMessage('¡Jaque mate! Problema resuelto.')
      completePuzzle(tsume.id)
      return
    }

    if (played >= tsume.plies) {
      setState({ ...state, position: after, played, lastMove: move, status: 'failed', moves })
      setMessage('Es jaque, pero no mate. Inténtalo de nuevo.')
      return
    }

    const waiting: State = { ...state, position: after, played, lastMove: move, status: 'waiting', moves }
    setState(waiting)
    setMessage('Jaque. El defensor responde…')
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const reply = defenderReply(after, tsume.plies - played - 1)
      if (!reply) return
      const position = applyMove(after, reply)
      const text = formatMove(after, reply, move.to)
      setState({ ...waiting, position, played: played + 1, lastMove: reply, status: 'playing', moves: [...moves, text] })
      setMessage(
        solveMate(position, tsume.plies - played - 1)
          ? `El defensor juega ${text}. Te queda una jugada.`
          : `El defensor juega ${text} y ya no hay mate. Reintenta.`,
      )
    }, 400)
  }

  function open(target: Tsume) {
    clearTimeout(timer.current)
    setState(start(target))
    setMessage(null)
    setExtra(null)
  }

  function showSolution() {
    const initial = tsumePosition(tsume)
    const line = solveMate(initial, tsume.plies) ?? []
    let position = initial
    let previous: Move | null = null
    const texts = line.map((move) => {
      const text = formatMove(position, move, previous?.to ?? null)
      position = applyMove(position, move)
      previous = move
      return text
    })
    setExtra(`Solución: ${texts.join(' ')}`)
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.progress}>
        {solved} de {TSUME.length} resueltos
      </Text>
      <View style={styles.chips}>
        {TSUME.map((item, i) => (
          <Pressable
            key={item.id}
            onPress={() => open(item)}
            accessibilityRole="button"
            accessibilityLabel={`${item.title}${progress.puzzles[item.id] ? ', resuelto' : ''}`}
            style={[styles.chip, progress.puzzles[item.id] && styles.chipDone, item.id === tsume.id && styles.chipActive]}
          >
            <Text style={styles.chipText}>{i + 1}</Text>
          </Pressable>
        ))}
      </View>

      <Card>
        <Text style={styles.kicker}>
          Problema {index + 1} · mate en {tsume.plies}
        </Text>
        <Text style={styles.title}>{tsume.title}</Text>
        <Text style={styles.body}>Juegas con Sente. Cada jugada debe ser jaque.</Text>
      </Card>

      <Board
        position={state.position}
        selection={input.selection}
        targets={input.targets}
        pending={input.pending}
        lastMove={state.lastMove}
        canUseHand={(owner) => owner === 'sente' && state.status === 'playing'}
        hideHand="gote"
        handLabel={() => 'Tu mano'}
        onSquare={input.selectSquare}
        onHand={input.selectHand}
      />

      {input.pending && <PromotionPanel position={state.position} pending={input.pending} onChoose={input.choosePromotion} />}
      {message && (
        <Feedback text={message} tone={state.status === 'solved' ? 'success' : state.status === 'failed' ? 'error' : 'neutral'} />
      )}
      {state.moves.length > 0 && <Text style={styles.body}>{state.moves.join('  ')}</Text>}
      {extra && <Feedback text={extra} />}

      <Row>
        {state.status === 'solved' && index < TSUME.length - 1 && (
          <Button title="Siguiente" variant="primary" onPress={() => open(TSUME[index + 1])} />
        )}
        <Button title="Reintentar" onPress={() => open(tsume)} />
        <Button title="Pista" onPress={() => setExtra(`💡 ${tsume.hint}`)} />
        <Button title="Solución" onPress={showSolution} />
      </Row>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.md },
  progress: { color: colors.muted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cdbb9a',
    backgroundColor: colors.surface,
  },
  chipDone: { borderColor: colors.hint, backgroundColor: colors.successBg },
  chipActive: { borderColor: colors.accent, borderWidth: 2 },
  chipText: { fontWeight: '700', color: colors.pieceText },
  kicker: { color: colors.accent, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  body: { color: colors.text, lineHeight: 20 },
})
