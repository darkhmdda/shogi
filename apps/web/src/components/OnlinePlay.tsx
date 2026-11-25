import './Training.css'
import { describeMove, emptyBoard, emptyHands, formatMove, isCheck, OWNER_LABEL, type Owner, type Position } from '@shogi/engine'
import { useMoveInput, useOnlineGame } from '@shogi/react'
import { useEffect, useState, type FormEvent } from 'react'
import { getOnlineProvider, useAccount, type OnlineState } from '../api'
import BoardView, { PromotionChoice } from './BoardView'

const emptyPosition: Position = { board: emptyBoard(), hands: emptyHands(), turn: 'sente' }

const REASONS: Record<string, string> = {
  checkmate: 'jaque mate',
  'no-moves': 'sin jugadas legales',
  repetition: 'sennichite (repetición)',
  'perpetual-check': 'jaque perpetuo',
  resignation: 'abandono',
  impasse: 'impasse',
}

function resultText(state: OnlineState): string {
  const reason = REASONS[state.reason ?? ''] ?? state.reason ?? '—'
  if (state.winner === null) {
    return state.reason === 'resignation' ? 'Partida cancelada.' : `Tablas por ${reason}.`
  }
  return state.your_side === state.winner ? `¡Has ganado por ${reason}!` : `Has perdido por ${reason}.`
}

export default function OnlinePlay() {
  const account = useAccount()
  const [code, setCode] = useState<string | null>(null)
  const [joinCode, setJoinCode] = useState('')
  const [lobbyError, setLobbyError] = useState<string | null>(null)
  const [myGames, setMyGames] = useState<OnlineState[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const provider = account ? getOnlineProvider() : null
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
  const yourTurn =
    state?.status === 'active' && game !== null && yourSide === game.position.turn && !online.sending

  const input = useMoveInput(game?.position ?? emptyPosition, {
    enabled: yourTurn,
    onMove: (move) => {
      if (game) setMessage(describeMove(game.position, move))
      online.sendMove(move)
    },
    onMessage: setMessage,
  })

  if (!account) {
    return (
      <p className="shogi-panel-section muted">
        Para jugar en línea necesitas una cuenta: crea una o inicia sesión en <a href="#cuenta">Tu cuenta</a>.
      </p>
    )
  }

  async function create(side: 'sente' | 'gote' | 'random') {
    setLobbyError(null)
    try {
      const created = await provider!.create(side)
      setCode(created.code)
      setMessage(null)
    } catch (error) {
      setLobbyError((error as Error).message)
    }
  }

  async function join(event: FormEvent) {
    event.preventDefault()
    setLobbyError(null)
    try {
      const joined = await provider!.join(joinCode.trim().toUpperCase())
      setCode(joined.code)
      setMessage(null)
    } catch (error) {
      setLobbyError((error as Error).message)
    }
  }

  if (!code) {
    return (
      <div className="online-lobby">
        <div className="shogi-panel-section online-card">
          <h3>Crear partida</h3>
          <p className="muted">Recibirás un código para compartir con tu rival.</p>
          <div className="shogi-buttons">
            <button type="button" onClick={() => create('random')}>Lado aleatorio</button>
            <button type="button" onClick={() => create('sente')}>Jugar con Sente</button>
            <button type="button" onClick={() => create('gote')}>Jugar con Gote</button>
          </div>
        </div>

        <form className="shogi-panel-section online-card account-form" onSubmit={join}>
          <h3>Unirse con un código</h3>
          <label>
            Código de la partida
            <input
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value)}
              placeholder="ABC234"
              maxLength={8}
              autoCapitalize="characters"
              required
            />
          </label>
          <div className="shogi-buttons">
            <button type="submit">Unirse</button>
          </div>
        </form>

        {myGames.length > 0 && (
          <div className="shogi-panel-section online-card">
            <h3>Tus partidas abiertas</h3>
            <ul className="account-games">
              {myGames.map((g) => (
                <li key={g.code}>
                  <button type="button" className="link-button" onClick={() => setCode(g.code)}>
                    {g.code}
                  </button>{' '}
                  · {g.sente ?? '¿?'} contra {g.gote ?? '¿?'} · {g.status === 'waiting' ? 'esperando rival' : `${g.moves.length} jugadas`}
                </li>
              ))}
            </ul>
          </div>
        )}

        {lobbyError && <p className="training-feedback error">{lobbyError}</p>}
      </div>
    )
  }

  const status = !state
    ? 'Conectando…'
    : state.status === 'waiting'
      ? `Esperando rival. Comparte el código ${state.code}.`
      : state.status === 'finished'
        ? resultText(state)
        : yourTurn
          ? `Tu turno (${OWNER_LABEL[yourSide!]})${game && isCheck(game) ? ' — ¡JAQUE!' : ''}`
          : online.sending
            ? 'Enviando jugada…'
            : 'Turno de tu rival…'

  return (
    <div className="shogi-game online-game">
      <p className={`shogi-turn${state?.status === 'finished' ? ' finished' : ''}`} aria-live="polite">
        {status}
      </p>
      <div className="shogi-layout">
        {game && (
          <BoardView
            position={game.position}
            selection={input.selection}
            targets={input.targets}
            pending={input.pending}
            lastMove={game.history.at(-1)?.move}
            flipped={yourSide === 'gote'}
            canUseHand={(owner) => owner === yourSide && yourTurn && !input.pending}
            handLabel={(owner) => `${owner === 'sente' ? state?.sente ?? 'Sente' : state?.gote ?? 'Gote'}${owner === yourSide ? ' (tú)' : ''}`}
            onSquare={input.selectSquare}
            onHand={input.selectHand}
          />
        )}
        <aside className="shogi-side-panel">
          <div className="shogi-panel-section">
            <h3>Partida {state?.code}</h3>
            <p>
              {state?.sente ?? '—'} (Sente) contra {state?.gote ?? '—'} (Gote)
            </p>
            <p className="muted">{online.connected ? 'Conectado en tiempo real.' : 'Actualizando cada pocos segundos.'}</p>
          </div>

          {input.pending && game && (
            <PromotionChoice position={game.position} pending={input.pending} onChoose={input.choosePromotion} />
          )}

          {(message || online.error) && (
            <div className="shogi-panel-section">
              {online.error && <p className="training-feedback error">{online.error}</p>}
              {message && <p className="shogi-message">{message}</p>}
            </div>
          )}

          <div className="shogi-panel-section">
            <h3>Registro</h3>
            {game && game.history.length > 0 ? (
              <ol className="kifu">
                {game.history.map((entry, index) => (
                  <li key={index}>{formatMove(entry.before, entry.move, index > 0 ? game.history[index - 1].move.to : null)}</li>
                ))}
              </ol>
            ) : (
              <p className="muted">Todavía no hay jugadas.</p>
            )}
          </div>

          <div className="shogi-buttons">
            {state?.status !== 'finished' && (
              <button type="button" onClick={() => online.resign()}>
                {state?.status === 'waiting' ? 'Cancelar partida' : 'Rendirse'}
              </button>
            )}
            <button type="button" onClick={() => setCode(null)}>
              Volver
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}

