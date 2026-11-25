import './Training.css'
import { useEffect, useState, type FormEvent } from 'react'
import {
  authenticate,
  changePassword,
  deleteAccount,
  listGames,
  logout,
  syncProgress,
  useAccount,
  useGamesVersion,
  type SavedGame,
} from '../api'
import { useProgress } from '../progress'

const REASONS: Record<string, string> = {
  checkmate: 'jaque mate',
  'no-moves': 'sin jugadas',
  repetition: 'repetición',
  'perpetual-check': 'jaque perpetuo',
  resignation: 'abandono',
  impasse: 'impasse',
}

/** Cuenta de usuario: sincroniza el progreso y guarda las partidas en el servidor. */
export default function AccountPanel() {
  const account = useAccount()
  const gamesVersion = useGamesVersion()
  const progress = useProgress()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [games, setGames] = useState<SavedGame[] | null>(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!account) return
    let active = true
    listGames()
      .then((list) => active && setGames(list))
      .catch(() => active && setGames([]))
    return () => {
      active = false
    }
  }, [account, gamesVersion])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setStatus(null)
    try {
      await authenticate(mode, username, password)
      setPassword('')
      setStatus(mode === 'register' ? 'Cuenta creada. Tu progreso ya está a salvo.' : 'Sesión iniciada y progreso sincronizado.')
    } catch (error) {
      setStatus((error as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function sync() {
    setBusy(true)
    try {
      await syncProgress()
      setStatus('Progreso sincronizado.')
    } catch (error) {
      setStatus((error as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (!account) {
    return (
      <form className="account-form shogi-panel-section" onSubmit={submit}>
        <div className="piece-guide-toolbar" role="group" aria-label="Tipo de acceso">
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>
            Iniciar sesión
          </button>
          <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>
            Crear cuenta
          </button>
        </div>
        <p className="muted">
          Opcional: con una cuenta tu progreso se guarda en el servidor y puedes continuar en otro dispositivo.
        </p>
        <label>
          Usuario
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            minLength={3}
            maxLength={32}
            required
          />
        </label>
        <label>
          Contraseña
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            minLength={8}
            required
          />
        </label>
        <div className="shogi-buttons">
          <button type="submit" disabled={busy}>
            {busy ? 'Conectando…' : mode === 'register' ? 'Crear cuenta' : 'Entrar'}
          </button>
        </div>
        {status && <p className="training-feedback" role="status">{status}</p>}
      </form>
    )
  }

  return (
    <div className="account-form shogi-panel-section">
      <h3>Hola, {account.username}</h3>
      <p className="muted">
        Tu progreso se sincroniza automáticamente: {Object.keys(progress.lessons).length} lecciones,{' '}
        {Object.keys(progress.puzzles).length} problemas, {progress.games.played} partidas.
      </p>
      <div className="shogi-buttons">
        <button type="button" onClick={sync} disabled={busy}>
          Sincronizar ahora
        </button>
        <button type="button" onClick={() => logout()}>
          Cerrar sesión
        </button>
      </div>
      {status && <p className="training-feedback" role="status">{status}</p>}

      <details className="account-security">
        <summary>Seguridad de la cuenta</summary>
        <form
          className="account-form"
          onSubmit={async (event) => {
            event.preventDefault()
            setBusy(true)
            try {
              await changePassword(currentPassword, newPassword)
              setStatus('Contraseña cambiada. Se han cerrado las demás sesiones.')
              setCurrentPassword('')
              setNewPassword('')
            } catch (error) {
              setStatus((error as Error).message)
            } finally {
              setBusy(false)
            }
          }}
        >
          <label>
            Contraseña actual
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <label>
            Contraseña nueva (mínimo 8 caracteres)
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          <div className="shogi-buttons">
            <button type="submit" disabled={busy}>
              Cambiar contraseña
            </button>
          </div>

          <p className="muted">
            Borrar la cuenta elimina del servidor tu progreso y tus partidas. El progreso guardado en este navegador
            se conserva.
          </p>
          <label className="checkbox-inline">
            <input type="checkbox" checked={confirmDelete} onChange={(event) => setConfirmDelete(event.target.checked)} />
            Entiendo que no se puede deshacer
          </label>
          <div className="shogi-buttons">
            <button
              type="button"
              className="danger"
              disabled={busy || !confirmDelete || currentPassword === ''}
              onClick={async () => {
                setBusy(true)
                try {
                  await deleteAccount(currentPassword)
                } catch (error) {
                  setStatus((error as Error).message)
                } finally {
                  setBusy(false)
                }
              }}
            >
              Borrar mi cuenta
            </button>
          </div>
          <p className="muted">Para borrar la cuenta escribe tu contraseña actual arriba.</p>
        </form>
      </details>

      <h3>Últimas partidas guardadas</h3>
      {games === null ? (
        <p className="muted">Cargando…</p>
      ) : games.length === 0 ? (
        <p className="muted">Todavía no hay partidas. Las partidas terminadas contra la máquina se guardan solas.</p>
      ) : (
        <ul className="account-games">
          {games.map((game) => {
            const outcome =
              game.winner === null ? 'Tablas' : game.winner === game.human_side ? 'Victoria' : 'Derrota'
            return (
              <li key={game.id}>
                <strong>{outcome}</strong> · {game.reason ? REASONS[game.reason] ?? game.reason : '—'} ·{' '}
                {game.moves.length} jugadas · {new Date(game.created_at).toLocaleDateString('es')}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
