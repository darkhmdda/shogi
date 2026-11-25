import type { SavedGame } from '@shogi/api'
import { useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import {
  LOGIN_WITH_EMAIL,
  authenticate,
  changePassword,
  deleteAccount,
  listGames,
  logout,
  requestPasswordReset,
  resendConfirmation,
  syncProgress,
  useAccount,
  useGamesVersion,
} from '../account'
import { Button, Card, Feedback, Row } from '../components/ui'
import { useProgress } from '../progress'
import { colors, spacing } from '../theme'

const REASONS: Record<string, string> = {
  checkmate: 'jaque mate',
  'no-moves': 'sin jugadas',
  repetition: 'repetición',
  'perpetual-check': 'jaque perpetuo',
  resignation: 'abandono',
  impasse: 'impasse',
}

function Field(props: {
  label: string
  value: string
  onChange: (value: string) => void
  secure?: boolean
  email?: boolean
  autoComplete?: 'email' | 'password' | 'new-password' | 'current-password' | 'nickname' | 'username'
}) {
  return (
    <>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        style={styles.input}
        value={props.value}
        onChangeText={props.onChange}
        secureTextEntry={props.secure}
        keyboardType={props.email ? 'email-address' : 'default'}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete={props.autoComplete}
        accessibilityLabel={props.label}
      />
    </>
  )
}

function Link({ title, onPress, disabled }: { title: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" hitSlop={8}>
      <Text style={[styles.link, disabled && { opacity: 0.5 }]}>{title}</Text>
    </Pressable>
  )
}

export function AccountScreen() {
  const account = useAccount()
  const gamesVersion = useGamesVersion()
  const progress = useProgress()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [games, setGames] = useState<SavedGame[]>([])
  const [showSecurity, setShowSecurity] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

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

  async function run(action: () => Promise<string | void>, success: string) {
    setBusy(true)
    setStatus(null)
    try {
      const message = await action()
      setStatus(message || success)
    } catch (error) {
      setStatus((error as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function needEmail(action: () => Promise<void>, success: string) {
    if (!email.trim()) {
      setStatus('Escribe primero tu correo electrónico.')
      return
    }
    run(action, success)
  }

  if (!account) {
    return (
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Card>
          <Row>
            <Button title="Iniciar sesión" variant={mode === 'login' ? 'primary' : 'secondary'} onPress={() => setMode('login')} />
            <Button title="Crear cuenta" variant={mode === 'register' ? 'primary' : 'secondary'} onPress={() => setMode('register')} />
          </Row>
          <Text style={styles.muted}>
            Opcional: con una cuenta tu progreso se guarda en el servidor y lo compartes con la web.
          </Text>

          {(!LOGIN_WITH_EMAIL || mode === 'register') && (
            <Field
              label={LOGIN_WITH_EMAIL ? 'Nombre de usuario (público)' : 'Usuario'}
              value={username}
              onChange={setUsername}
              autoComplete={LOGIN_WITH_EMAIL ? 'nickname' : 'username'}
            />
          )}
          {LOGIN_WITH_EMAIL && (
            <Field label="Correo electrónico" value={email} onChange={setEmail} email autoComplete="email" />
          )}
          <Field
            label="Contraseña"
            value={password}
            onChange={setPassword}
            secure
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
          />

          <Button
            title={busy ? 'Conectando…' : mode === 'register' ? 'Crear cuenta' : 'Entrar'}
            variant="primary"
            disabled={busy}
            onPress={() =>
              run(async () => {
                const { needsConfirmation } = await authenticate(mode, { username, email, password })
                setPassword('')
                if (needsConfirmation) {
                  return `Cuenta creada. Te hemos enviado un correo a ${email.trim()}: pulsa el enlace para confirmarla y luego inicia sesión aquí.`
                }
              }, mode === 'register' ? 'Cuenta creada.' : 'Sesión iniciada y progreso sincronizado.')
            }
          />

          {LOGIN_WITH_EMAIL && mode === 'login' && (
            <View style={styles.links}>
              <Link
                title="¿Olvidaste tu contraseña?"
                disabled={busy}
                onPress={() =>
                  needEmail(
                    () => requestPasswordReset(email),
                    `Si existe una cuenta con ${email.trim()}, te llegará un correo con un enlace para elegir una contraseña nueva (se abre en la web). Revisa también el spam.`,
                  )
                }
              />
              <Link
                title="Reenviar el correo de confirmación"
                disabled={busy}
                onPress={() =>
                  needEmail(
                    () => resendConfirmation(email),
                    `Si la cuenta de ${email.trim()} está pendiente de confirmar, te hemos vuelto a enviar el correo.`,
                  )
                }
              />
            </View>
          )}
          {status && <Feedback text={status} />}
        </Card>
      </ScrollView>
    )
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
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

      <Card>
        <Pressable onPress={() => setShowSecurity(!showSecurity)} accessibilityRole="button">
          <Text style={styles.title}>{showSecurity ? '▾' : '▸'} Seguridad de la cuenta</Text>
        </Pressable>
        {showSecurity && (
          <View style={styles.security}>
            <Field label="Contraseña actual" value={current} onChange={setCurrent} secure autoComplete="current-password" />
            <Field
              label="Contraseña nueva (mínimo 8 caracteres)"
              value={next}
              onChange={setNext}
              secure
              autoComplete="new-password"
            />
            <Button
              title="Cambiar contraseña"
              variant="primary"
              disabled={busy || current === '' || next.length < 8}
              onPress={() =>
                run(async () => {
                  await changePassword(current, next)
                  setCurrent('')
                  setNext('')
                }, 'Contraseña cambiada. Se han cerrado las demás sesiones.')
              }
            />

            <Text style={styles.muted}>
              Borrar la cuenta elimina del servidor tu progreso y tus partidas. Lo guardado en este teléfono se
              conserva. Para borrarla, escribe arriba tu contraseña actual.
            </Text>
            <Pressable
              onPress={() => setConfirmDelete(!confirmDelete)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: confirmDelete }}
              style={styles.checkRow}
            >
              <Text style={styles.check}>{confirmDelete ? '☑' : '☐'}</Text>
              <Text style={styles.body}>Entiendo que no se puede deshacer</Text>
            </Pressable>
            <Button
              title="Borrar mi cuenta"
              disabled={busy || !confirmDelete || current === ''}
              onPress={() => run(() => deleteAccount(current), 'Cuenta borrada.')}
            />
          </View>
        )}
      </Card>

      <Text style={styles.title}>Últimas partidas</Text>
      {games.length === 0 ? (
        <Text style={styles.muted}>Las partidas terminadas contra la máquina se guardan aquí.</Text>
      ) : (
        <View style={styles.games}>
          {games.map((game) => (
            <Text key={game.id} style={styles.body}>
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
  body: { color: colors.text, lineHeight: 20 },
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
  links: { gap: spacing.sm },
  link: { color: colors.sente, fontWeight: '600', textDecorationLine: 'underline' },
  security: { gap: spacing.sm },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  check: { fontSize: 20, color: colors.text },
  games: { gap: 6 },
})
