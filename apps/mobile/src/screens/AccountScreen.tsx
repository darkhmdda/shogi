import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { authenticate, listGames, logout, syncProgress, useAccount, useGamesVersion } from '../account'
import { Button, Card, Feedback, Row } from '../components/ui'
import { useProgress } from '../progress'
import { colors, spacing } from '../theme'
import type { SavedGame } from '@shogi/api'

const REASONS: Record<string, string> = {
  checkmate: 'jaque mate',
  'no-moves': 'sin jugadas',
  repetition: 'repetición',
  'perpetual-check': 'jaque perpetuo',
  resignation: 'abandono',
  impasse: 'impasse',
}

export function AccountScreen() {
  const account = useAccount()
  const gamesVersion = useGamesVersion()
  const progress = useProgress()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [games, setGames] = useState<SavedGame[]>([])

  useEffect(() => {
    if (!account) return
    let active = true
    listGames()
      .then((list) => active && setGames(list))
      .catch(() => {})
    return () => {
      active = false
    }
  }, [account, gamesVersion])

  async function run(action: () => Promise<void>, success: string) {
    setBusy(true)
    setStatus(null)
    try {
      await action()
      setStatus(success)
    } catch (error) {
      setStatus((error as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (!account) {
    return (
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Card>
          <Row>
            <Button title="Iniciar sesión" variant={mode === 'login' ? 'primary' : 'secondary'} onPress={() => setMode('login')} />
            <Button title="Crear cuenta" variant={mode === 'register' ? 'primary' : 'secondary'} onPress={() => setMode('register')} />
          </Row>
          <Text style={styles.muted}>Con una cuenta, tu progreso se guarda en el servidor y lo compartes con la web.</Text>
          <Text style={styles.label}>Usuario</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            accessibilityLabel="Usuario"
          />
          <Text style={styles.label}>Contraseña</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            accessibilityLabel="Contraseña"
          />
          <Button
            title={busy ? 'Conectando…' : mode === 'register' ? 'Crear cuenta' : 'Entrar'}
            variant="primary"
            disabled={busy}
            onPress={() =>
              run(
                () => authenticate(mode, username, password).then(() => setPassword('')),
                mode === 'register' ? 'Cuenta creada.' : 'Sesión iniciada y progreso sincronizado.',
              )
            }
          />
          {status && <Feedback text={status} />}
        </Card>
      </ScrollView>
    )
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card>
        <Text style={styles.title}>Hola, {account.username}</Text>
        <Text style={styles.muted}>
          {Object.keys(progress.lessons).length} lecciones · {Object.keys(progress.puzzles).length} problemas ·{' '}
          {progress.games.played} partidas. Se sincroniza solo.
        </Text>
        <Row>
          <Button title="Sincronizar ahora" disabled={busy} onPress={() => run(syncProgress, 'Progreso sincronizado.')} />
          <Button title="Cerrar sesión" onPress={() => logout()} />
        </Row>
        {status && <Feedback text={status} />}
      </Card>

      <Text style={styles.title}>Últimas partidas</Text>
      {games.length === 0 ? (
        <Text style={styles.muted}>Las partidas terminadas contra la máquina se guardan aquí.</Text>
      ) : (
        <View style={styles.games}>
          {games.map((game) => (
            <Text key={game.id} style={styles.game}>
              <Text style={{ fontWeight: '700' }}>
                {game.winner === null ? 'Tablas' : game.winner === game.human_side ? 'Victoria' : 'Derrota'}
              </Text>{' '}
              · {game.reason ? REASONS[game.reason] ?? game.reason : '—'} · {game.moves.length} jugadas ·{' '}
              {new Date(game.created_at).toLocaleDateString('es')}
            </Text>
          ))}
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.md },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  muted: { color: colors.muted, lineHeight: 20 },
  label: { fontWeight: '700', color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: '#cdbb9a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    fontSize: 16,
    color: colors.text,
  },
  games: { gap: 6 },
  game: { color: colors.text, lineHeight: 20 },
})
