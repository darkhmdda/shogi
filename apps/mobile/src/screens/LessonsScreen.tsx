import { applyMove, describeMove, fromSfen, goalSatisfied, LESSONS, type Lesson, type Move, type Position } from '@shogi/engine'
import { useMoveInput } from '@shogi/react'
import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native'
import { Board, PromotionPanel } from '../components/Board'
import { Button, Card, Feedback, Row } from '../components/ui'
import { completeLesson, useProgress } from '../progress'
import { colors, spacing } from '../theme'

type State = { lessonId: string; step: number; position: Position; lastMove?: Move; done: boolean }

const startStep = (lesson: Lesson, step: number): State => ({
  lessonId: lesson.id,
  step,
  position: fromSfen(lesson.steps[step].sfen),
  done: false,
})

export function LessonsScreen() {
  const progress = useProgress()
  const [state, setState] = useState<State>(() => startStep(LESSONS.find((l) => !progress.lessons[l.id]) ?? LESSONS[0], 0))
  const [message, setMessage] = useState<string | null>(null)
  const [hint, setHint] = useState(false)

  const lesson = LESSONS.find((l) => l.id === state.lessonId)!
  const step = lesson.steps[state.step]
  const isLast = state.step === lesson.steps.length - 1
  const lessonIndex = LESSONS.indexOf(lesson)

  const input = useMoveInput(state.position, {
    enabled: !state.done,
    onMove: (move) => {
      if (!goalSatisfied(step.goal, state.position, move)) {
        setMessage(`Es legal, pero no es el objetivo. ${step.hint}`)
        return
      }
      setState({ ...state, position: applyMove(state.position, move), lastMove: move, done: true })
      setMessage(`${step.success} (${describeMove(state.position, move)})`)
      if (isLast) completeLesson(lesson.id)
    },
    onMessage: setMessage,
  })

  function goTo(target: Lesson, index = 0) {
    setState(startStep(target, index))
    setMessage(null)
    setHint(false)
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.list}>
        {LESSONS.map((entry, index) => (
          <Pressable
            key={entry.id}
            onPress={() => goTo(entry)}
            accessibilityRole="button"
            accessibilityState={{ selected: entry.id === lesson.id }}
            style={[styles.item, entry.id === lesson.id && styles.itemActive]}
          >
            <Text style={styles.kanji}>{entry.kanji}</Text>
            <Text style={styles.itemText} numberOfLines={1}>
              {index + 1}. {entry.title} {progress.lessons[entry.id] ? '✓' : ''}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <Card>
        <Text style={styles.kicker}>
          Lección {lessonIndex + 1} · paso {state.step + 1} de {lesson.steps.length}
        </Text>
        <Text style={styles.title}>{lesson.title}</Text>
        <Text style={styles.body}>{step.instruction}</Text>
      </Card>

      <Board
        position={state.position}
        selection={input.selection}
        targets={input.targets}
        pending={input.pending}
        lastMove={state.lastMove}
        canUseHand={(owner) => owner === state.position.turn && !state.done}
        onSquare={input.selectSquare}
        onHand={input.selectHand}
      />

      {input.pending && <PromotionPanel position={state.position} pending={input.pending} onChoose={input.choosePromotion} />}
      {message && <Feedback text={message} tone={state.done ? 'success' : 'neutral'} />}
      {hint && !state.done && <Feedback text={`💡 ${step.hint}`} />}

      <Row>
        {state.done && (!isLast || lessonIndex < LESSONS.length - 1) && (
          <Button
            title={isLast ? 'Siguiente lección' : 'Siguiente paso'}
            variant="primary"
            onPress={() => (isLast ? goTo(LESSONS[lessonIndex + 1]) : goTo(lesson, state.step + 1))}
          />
        )}
        {!state.done && <Button title="Pista" onPress={() => setHint(true)} />}
        <Button title="Repetir paso" onPress={() => goTo(lesson, state.step)} />
      </Row>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.md },
  list: { gap: spacing.sm },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  itemActive: { borderColor: colors.accent, borderWidth: 2 },
  kanji: { fontSize: 18, color: colors.pieceText },
  itemText: { color: colors.text, fontWeight: '600' },
  kicker: { color: colors.accent, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  body: { color: colors.text, lineHeight: 21, fontSize: 15 },
})
