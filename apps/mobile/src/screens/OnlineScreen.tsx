import type { OnlineState } from '@shogi/api'
import { describeMove, emptyBoard, emptyHands, formatMove, isCheck, OWNER_LABEL, type Owner, type Position } from '@shogi/engine'
import { useMoveInput, useOnlineGame } from '@shogi/react'
import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { getOnlineProvider, useAccount } from '../account'
import { Board, PromotionPanel } from '../components/Board'
import { Button, Card, Feedback, Row } from '../components/ui'
import {type Colors, spacing, useColors, useStyles} from '../theme'

const emptyPosition: Position = { board: emptyBoard(), hands: emptyHands(), turn: 'sente' }

const REASONS: Record<string, string> = {
  checkmate: 'jaque mate',
  'no-moves': 'sin jugadas legales',
  repetition: 'repetición',
  'perpetual-check': 'jaque perpetuo',
  resignation: 'abandono',
  impasse: 'impasse',
}

function resultText(state: OnlineState): string {
  const reason = REASONS[state.reason ?? ''] ?? state.reason ?? '—'
  if (state.winner === null) return state.reason === 'resignation' ? 'Partida cancelada.' : `Tablas por ${reason}.`
  return state.your_side === state.winner ? `¡Has ganado por ${reason}!` : `Has perdido por ${reason}.`
}

export function OnlineScreen({ onNeedAccount }: { onNeedAccount: () => void }) {
  const styles = useStyles(createStyles)
  const account = useAccount()
  const provider = account ? getOnlineProvider() : null
  const [code, setCode] = useState<string | null>(null)
  const [joinCode, setJoinCode] = useState('')
  const [lobbyError, setLobbyError] = useState<string | null>(null)
  const [myGames, setMyGames] = useState<OnlineState[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const online = useOnlineGame(provider, code)

  useEffect(() => {
    if (!account || !provider || code) return
    let active = true
    provider
      .list()
      .then((games) => active && setMyGames(games.filter((g) => g.status !== 'finished')))
      .catch(() => {})
    return () => {
      active = false
    }
  }, [account, provider, code])

  const game = online.game
  const state = online.state
  const yourSide = (state?.your_side ?? null) as Owner | null
  const yourTurn = state?.status === 'active' && game !== null && yourSide === game.position.turn && !online.sending

  const input = useMoveInput(game?.position ?? emptyPosition, {
    enabled: yourTurn,
    onMove: (move) => {
      if (game) setMessage(describeMove(game.position, move))
      online.sendMove(move)
    },
    onMessage: setMessage,
  })

  if (!account || !provider) {
    return (
      <View style={styles.container}>
        <Card>
          <Text style={styles.title}>Juega contra otra persona</Text>
          <Text style={styles.body}>Para jugar en línea necesitas una cuenta.</Text>
          <Button title="Ir a Cuenta" variant="primary" onPress={onNeedAccount} />
        </Card>
      </View>
    )
  }

  async function run(action: () => Promise<OnlineState>) {
    setLobbyError(null)
    try {
      const result = await action()
      setCode(result.code)
      setMessage(null)
    } catch (error) {
      setLobbyError((error as Error).message)
    }
  }

  if (!code) {
    return (
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Card>
          <Text style={styles.title}>Crear partida</Text>
          <Text style={styles.muted}>Recibirás un código para compartir con tu rival.</Text>
          <Row>
            <Button title="Lado aleatorio" variant="primary" onPress={() => run(() => provider.create('random'))} />
            <Button title="Sente" onPress={() => run(() => provider.create('sente'))} />
            <Button title="Gote" onPress={() => run(() => provider.create('gote'))} />
          </Row>
        </Card>
        <Card>
          <Text style={styles.title}>Unirse con un código</Text>
          <TextInput
            style={styles.input}
            value={joinCode}
            onChangeText={setJoinCode}
            placeholder="ABC234"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={8}
            accessibilityLabel="Código de la partida"
          />
          <Button title="Unirse" onPress={() => run(() => provider.join(joinCode.trim().toUpperCase()))} />
        </Card>
        {myGames.length > 0 && (
          <Card>
            <Text style={styles.title}>Tus partidas abiertas</Text>
            {myGames.map((g) => (
              <Button
                key={g.code}
                title={`${g.code} · ${g.sente ?? '¿?'} contra ${g.gote ?? '¿?'}`}
                onPress={() => setCode(g.code)}
              />
            ))}
          </Card>
        )}
        {lobbyError && <Feedback text={lobbyError} tone="error" />}
      </ScrollView>
    )
  }

  const status = !state
    ? 'Conectando…'
    : state.status === 'waiting'
      ? `Esperando rival. Código: ${state.code}`
      : state.status === 'finished'
        ? resultText(state)
        : yourTurn
          ? `Tu turno (${OWNER_LABEL[yourSide!]})${game && isCheck(game) ? ' — ¡JAQUE!' : ''}`
          : online.sending
            ? 'Enviando jugada…'
            : 'Turno de tu rival…'

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={[styles.status, state?.status === 'finished' && styles.statusDone]} accessibilityLiveRegion="polite">
        {status}
      </Text>
      {game && (
        <Board
          position={game.position}
          selection={input.selection}
          targets={input.targets}
          pending={input.pending}
          lastMove={game.history.at(-1)?.move}
          flipped={yourSide === 'gote'}
          canUseHand={(owner) => owner === yourSide && yourTurn && !input.pending}
          handLabel={(owner) => `${(owner === 'sente' ? state?.sente : state?.gote) ?? owner}${owner === yourSide ? ' (tú)' : ''}`}
          onSquare={input.selectSquare}
          onHand={input.selectHand}
        />
      )}
      {input.pending && game && <PromotionPanel position={game.position} pending={input.pending} onChoose={input.choosePromotion} />}
      {online.error && <Feedback text={online.error} tone="error" />}
      {message && <Feedback text={message} />}
      <Text style={styles.muted}>
        Partida {state?.code} · {online.connected ? 'en tiempo real' : 'actualizando cada pocos segundos'}
      </Text>
      {game && game.history.length > 0 && (
        <Text style={styles.body}>
          {game.history
            .map((entry, index) => formatMove(entry.before, entry.move, index > 0 ? game.history[index - 1].move.to : null))
            .join('  ')}
        </Text>
      )}
      <Row>
        {state?.status !== 'finished' && (
          <Button title={state?.status === 'waiting' ? 'Cancelar' : 'Rendirse'} onPress={() => online.resign()} />
        )}
        <Button title="Volver" onPress={() => setCode(null)} />
      </Row>
    </ScrollView>
  )
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.md },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  body: { color: colors.text, lineHeight: 21 },
  muted: { color: colors.muted, lineHeight: 20 },
  input: {
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    fontSize: 18,
    letterSpacing: 3,
    color: colors.text,
  },
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
})
