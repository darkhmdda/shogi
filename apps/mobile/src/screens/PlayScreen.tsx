import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  describeMove,
  deserializeGame,
  formatMove,
  isCheck,
  newGame,
  OWNER_LABEL,
  OWNER_SHORT,
  otherOwner,
  playMove,
  resign,
  search,
  serializeGame,
  undo,
  type Difficulty,
  type GameResult,
  type GameState,
  type Move,
  type Owner,
} from '@shogi/engine'
import { useMoveInput } from '@shogi/react'
import { useEffect, useRef, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { Board, PromotionPanel } from '../components/Board'
import { Button, Card, Feedback, Row } from '../components/ui'
import { uploadGame } from '../account'
import { recordGame } from '../progress'
import {type Colors, spacing, useColors, useStyles} from '../theme'

const STORAGE_KEY = 'shogi.mobile.game.v1'

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 'easy', label: 'Fácil' },
  { value: 'normal', label: 'Normal' },
  { value: 'hard', label: 'Difícil' },
]

/** En el móvil la IA piensa en el hilo principal, así que se limita su tiempo. */
const MOBILE_TIME: Record<Difficulty, number> = { easy: 250, normal: 700, hard: 1500 }

function resultText(result: GameResult): string {
  const winner = result.winner ? OWNER_LABEL[result.winner] : ''
  switch (result.reason) {
    case 'checkmate':
      return `¡Jaque mate! Gana ${winner}.`
    case 'no-moves':
      return `Sin jugadas legales. Gana ${winner}.`
    case 'repetition':
      return 'Sennichite: tablas por repetición.'
    case 'perpetual-check':
      return `Jaque perpetuo. Gana ${winner}.`
    case 'resignation':
      return `Abandono. Gana ${winner}.`
    case 'impasse':
      return `Impasse declarado. Gana ${winner}.`
  }
}

export function PlayScreen() {
  const styles = useStyles(createStyles)
  const [game, setGame] = useState<GameState>(() => newGame())
  const [humanSide, setHumanSide] = useState<Owner>('sente')
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  const [message, setMessage] = useState('Juegas con Sente (azul). Toca una pieza para ver sus movimientos.')
  const [thinking, setThinking] = useState(false)
  const loaded = useRef(false)

  const { position, result } = game
  const aiSide = otherOwner(humanSide)
  const isHumanTurn = position.turn === humanSide && !result

  const input = useMoveInput(position, {
    enabled: isHumanTurn && !thinking,
    onMove: (move) => commit(game, move, false),
    onMessage: setMessage,
  })

  // Recupera la última partida al abrir la app.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return
        const stored = JSON.parse(raw) as { game: ReturnType<typeof serializeGame>; humanSide: Owner; difficulty: Difficulty }
        setGame(deserializeGame(stored.game))
        setHumanSide(stored.humanSide)
        setDifficulty(stored.difficulty)
        setMessage('Partida recuperada.')
      })
      .catch(() => {})
      .finally(() => {
        loaded.current = true
      })
  }, [])

  useEffect(() => {
    if (!loaded.current) return
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ game: serializeGame(game), humanSide, difficulty })).catch(() => {})
  }, [game, humanSide, difficulty])

  function finish(next: GameState) {
    if (!next.result) return
    if (next.result.winner === null) recordGame('drawn')
    else recordGame(next.result.winner === humanSide ? 'won' : 'lost')

    // Con sesión iniciada, la partida se guarda también en el servidor.
    const saved = serializeGame(next)
    uploadGame({
      sfen: saved.sfen,
      moves: saved.moves,
      winner: next.result.winner,
      reason: next.result.reason,
      mode: 'ai',
      difficulty,
      human_side: humanSide,
    }).catch(() => {})
  }

  function commit(current: GameState, move: Move, byMachine: boolean) {
    const next = playMove(current, move)
    const notation = formatMove(current.position, move, current.history.at(-1)?.move.to ?? null)
    setGame(next)
    setMessage(
      next.result
        ? resultText(next.result)
        : `${byMachine ? 'La máquina juega' : 'Jugada'} ${notation}. ${describeMove(current.position, move)}`,
    )
    finish(next)
  }

  const commitRef = useRef(commit)
  useEffect(() => {
    commitRef.current = commit
  })

  // Turno de la máquina: se deja un instante para que la interfaz se actualice.
  useEffect(() => {
    if (result || position.turn !== aiSide) return
    let cancelled = false
    setThinking(true)
    const timer = setTimeout(() => {
      const info = search(position, difficulty, Math.random, { timeMs: MOBILE_TIME[difficulty] })
      if (cancelled) return
      setThinking(false)
      if (info.move) commitRef.current(game, info.move, true)
    }, 60)
    return () => {
      cancelled = true
      clearTimeout(timer)
      setThinking(false)
    }
  }, [game, position, result, aiSide, difficulty])

  function restart(side: Owner = humanSide) {
    setHumanSide(side)
    setGame(newGame())
    setMessage(`Nueva partida: juegas con ${OWNER_LABEL[side]}.`)
  }

  function handleUndo() {
    const plies = position.turn === humanSide && game.history.length >= 2 ? 2 : 1
    setGame(undo(game, plies))
    setMessage('Jugada deshecha.')
  }

  function handleResign() {
    const next = resign(game, humanSide)
    setGame(next)
    setMessage(resultText(next.result!))
    finish(next)
  }

  const status = result
    ? resultText(result)
    : thinking
      ? 'La máquina está pensando…'
      : `Turno de ${OWNER_LABEL[position.turn]}${isCheck(game) ? ' — ¡JAQUE!' : ''}`

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={[styles.status, result && styles.statusDone]} accessibilityLiveRegion="polite">
        {status}
      </Text>

      <Board
        position={position}
        selection={input.selection}
        targets={input.targets}
        pending={input.pending}
        lastMove={game.history.at(-1)?.move}
        canUseHand={(owner) => owner === humanSide && isHumanTurn && !input.pending}
        handLabel={(owner) => `${OWNER_SHORT[owner]}${owner === aiSide ? ' · máquina' : ''}`}
        onSquare={input.selectSquare}
        onHand={input.selectHand}
      />

      {input.pending && <PromotionPanel position={position} pending={input.pending} onChoose={input.choosePromotion} />}

      <Feedback text={message} />

      <Card>
        <Row>
          <Button title="Nueva partida" variant="primary" onPress={() => restart()} />
          <Button title="Deshacer" onPress={handleUndo} disabled={game.history.length === 0 || thinking} />
          <Button title="Rendirse" onPress={handleResign} disabled={result !== null} />
        </Row>
        <Text style={styles.label}>Dificultad</Text>
        <Row>
          {DIFFICULTIES.map((level) => (
            <Button
              key={level.value}
              title={level.label}
              variant={difficulty === level.value ? 'primary' : 'secondary'}
              onPress={() => setDifficulty(level.value)}
            />
          ))}
        </Row>
        <Text style={styles.label}>Juegas con</Text>
        <Row>
          <Button title="Sente (empieza)" variant={humanSide === 'sente' ? 'primary' : 'secondary'} onPress={() => restart('sente')} />
          <Button title="Gote" variant={humanSide === 'gote' ? 'primary' : 'secondary'} onPress={() => restart('gote')} />
        </Row>
      </Card>

      {game.history.length > 0 && (
        <View style={styles.kifu}>
          <Text style={styles.label}>Registro</Text>
          <Text style={styles.kifuText}>
            {game.history
              .map((entry, index) => formatMove(entry.before, entry.move, index > 0 ? game.history[index - 1].move.to : null))
              .join('  ')}
          </Text>
        </View>
      )}
    </ScrollView>
  )
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.md },
  status: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    fontWeight: '700',
    color: colors.text,
  },
  statusDone: { backgroundColor: colors.successBg, color: colors.success },
  label: { fontWeight: '700', color: colors.text, marginTop: 4 },
  kifu: { gap: 4 },
  kifuText: { color: colors.text, lineHeight: 22 },
})
