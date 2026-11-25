
import './App.css'
import { useEffect, useState } from 'react'
import AccountPanel from './components/AccountPanel'
import Lessons from './components/Lessons'
import ThemeToggle from './components/ThemeToggle'
import OnlinePlay from './components/OnlinePlay'
import PieceGuide from './components/PieceGuide'
import Puzzles from './components/Puzzles'
import ShogiBoard from './components/ShogiBoard'
import { LESSONS } from '@shogi/engine'
import { TSUME } from '@shogi/engine'
import { useProgress } from './progress'
import { ACCOUNTS_AVAILABLE, ONLINE_AVAILABLE } from './api'

const sections = [
  { icon: '⌂', label: 'Inicio', href: '#inicio' },
  { icon: '書', label: 'Aprender', href: '#aprender' },
  { icon: '棋', label: 'Practicar', href: '#problemas' },
  { icon: '対', label: 'Jugar', href: '#tablero' },
  ...(ONLINE_AVAILABLE ? [{ icon: '網', label: 'En línea', href: '#en-linea' }] : []),
  ...(ACCOUNTS_AVAILABLE ? [{ icon: '人', label: 'Cuenta', href: '#cuenta' }] : []),
]

function useHash(): string {
  const [hash, setHash] = useState(() => window.location.hash || '#inicio')

  useEffect(() => {
    const update = () => setHash(window.location.hash || '#inicio')
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])

  return hash
}

const features = [
  {
    number: '01',
    title: 'Aprende a jugar',
    description: 'Dieciséis lecciones interactivas: de mover tu primer peón a defender, atacar y dar mate.',
    icon: '駒',
    action: 'Empezar las lecciones',
    href: '#aprender',
  },
  {
    number: '02',
    title: 'Resuelve problemas',
    description: 'Treinta y dos problemas de mate (tsume) en una, tres y cinco jugadas, con pistas y soluciones.',
    icon: '歩',
    action: 'Resolver problemas',
    href: '#problemas',
  },
  {
    number: '03',
    title: 'Juega una partida',
    description: 'Contra la máquina en tres niveles, contra un amigo en el mismo dispositivo o en línea.',
    icon: '王',
    action: 'Jugar ahora',
    href: '#tablero',
  },
]

function App() {
  const hash = useHash()
  const progress = useProgress()
  const lessonsDone = Object.keys(progress.lessons).filter((id) => LESSONS.some((l) => l.id === id)).length
  const puzzlesDone = Object.keys(progress.puzzles).filter((id) => TSUME.some((t) => t.id === id)).length

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#inicio" aria-label="Shōgi, inicio">
          <span className="brand-mark">将</span>
          <span className="brand-name">shōgi<span>.</span></span>
        </a>

        <div className="sidebar-label">MENÚ PRINCIPAL</div>

        <nav className="navigation" aria-label="Navegación principal">
          {sections.map((section) => (
            <a
              key={section.label}
              className={`nav-link ${hash === section.href ? 'active' : ''}`}
              href={section.href}
              aria-current={hash === section.href ? 'page' : undefined}
            >
              <span className="nav-icon" aria-hidden="true">{section.icon}</span>
              <span>{section.label}</span>
            </a>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-decoration" aria-hidden="true">棋</div>
          <p>Un movimiento a la vez.</p>
          <span>将棋 · El camino de las piezas</span>
        </div>
      </aside>

      <main className="main-content" id="inicio">
        <header className="topbar">
          <div className="breadcrumb">Tu espacio <span>/</span> Inicio</div>
          <div className="topbar-right">
            <div className="level-label">
              <span className="status-dot" />
              RUTA DEL PRINCIPIANTE
            </div>
            <ThemeToggle />
          </div>
        </header>

        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow">
              <span className="eyebrow-line" />
              BIENVENIDO AL SHŌGI
            </span>

            <h1>
              Cada gran jugador
              <br />
              <span>comienza con</span>
              <br />
              un movimiento.
            </h1>

            <p className="hero-description">
              Descubre el ajedrez japonés a tu ritmo. Aprende las piezas,
              comprende sus movimientos y encuentra tu propia estrategia.
            </p>

            <div className="hero-actions">
              <a className="button-primary" href="#piezas">
                Comenzar a aprender <span aria-hidden="true">↗</span>
              </a>
              <span className="hero-note">Sin prisa. Movimiento a movimiento.</span>
            </div>
          </div>

          <div className="hero-art" aria-label="Ilustración decorativa de un tablero de shōgi">
            <div className="art-caption art-caption-top">日本の将棋</div>
            <div className="mini-board">
              {Array.from({ length: 25 }, (_, index) => (
                <div className="mini-square" key={index}>
                  {[2, 6, 8, 12, 16, 18, 22].includes(index) && (
                    <span className={`mini-piece piece-${index}`}>
                      {index === 12 ? '王' : index % 2 === 0 ? '歩' : '金'}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="art-circle" aria-hidden="true">将</div>
            <div className="art-caption art-caption-bottom">
              <span>戦略</span>
              <span> · </span>
              <span>集中</span>
              <span> · </span>
              <span>忍耐</span>
            </div>
          </div>
        </section>

        <section className="learning-section" id="secciones">
          <div className="section-heading">
            <div>
              <span className="eyebrow">TU CAMINO COMIENZA AQUÍ</span>
              <h2>Aprende a tu manera</h2>
            </div>
            <span className="section-counter">01 — 03</span>
          </div>

          <div className="feature-grid">
            {features.map((feature) => (
              <article className="feature-card" key={feature.number}>
                <div className="feature-top">
                  <span className="feature-number">{feature.number}</span>
                  <span className="feature-icon" aria-hidden="true">{feature.icon}</span>
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
                <a
                  className="feature-action"
                  href={feature.href}
                  aria-label={`${feature.action}: ${feature.title}`}
                >
                  {feature.action} <span aria-hidden="true">→</span>
                </a>
              </article>
            ))}
          </div>
        </section>

        <section className="progress-strip" aria-label="Tu progreso">
          <div>
            <strong>{lessonsDone}/{LESSONS.length}</strong>
            <span>lecciones</span>
          </div>
          <div>
            <strong>{puzzlesDone}/{TSUME.length}</strong>
            <span>problemas</span>
          </div>
          <div>
            <strong>{progress.games.won}</strong>
            <span>victorias contra la máquina</span>
          </div>
        </section>

        <section className="board-section" id="aprender">
          <div className="section-heading">
            <div>
              <span className="eyebrow">LECCIONES</span>
              <h2>Aprende paso a paso</h2>
            </div>
            <span className="section-counter">{lessonsDone} / {LESSONS.length}</span>
          </div>

          <p className="board-intro">
            Cada lección te pide una jugada concreta en el tablero. Si te
            equivocas, te explicamos por qué; si te atascas, pide una pista.
          </p>

          <Lessons />
        </section>

        <section className="board-section" id="piezas">
          <div className="section-heading">
            <div>
              <span className="eyebrow">LAS PIEZAS</span>
              <h2>Cómo se mueve cada pieza</h2>
            </div>
            <span className="section-counter">8 + 6</span>
          </div>

          <p className="board-intro">
            Cada diagrama muestra la pieza vista desde tu lado (Sente): arriba
            es hacia delante. Las casillas oscuras se alcanzan de un paso; las
            claras, a cualquier distancia mientras el camino esté libre.
          </p>

          <PieceGuide />
        </section>

        <section className="board-section" id="problemas">
          <div className="section-heading">
            <div>
              <span className="eyebrow">TSUME SHŌGI · 詰将棋</span>
              <h2>Problemas de mate</h2>
            </div>
            <span className="section-counter">{puzzlesDone} / {TSUME.length}</span>
          </div>

          <p className="board-intro">
            Los tsume son la mejor forma de mejorar: encuentra el jaque mate en
            una, tres o cinco jugadas. Todos los problemas están verificados por el
            motor.
          </p>

          <Puzzles />
        </section>

        <section className="board-section" id="tablero">
          <div className="section-heading">
            <div>
              <span className="eyebrow">TABLERO</span>
              <h2>Juega y practica</h2>
            </div>
            <span className="section-counter">9 × 9</span>
          </div>

          <p className="board-intro">
            Selecciona una pieza para ver adónde puede ir. Si intentas un
            movimiento ilegal, el panel te explica por qué. Puedes jugar contra
            la máquina, contra otra persona o cargar posiciones de práctica.
          </p>

          <ShogiBoard />
        </section>

        {ONLINE_AVAILABLE && (
          <section className="board-section" id="en-linea">
            <div className="section-heading">
              <div>
                <span className="eyebrow">EN LÍNEA</span>
                <h2>Juega contra otra persona</h2>
              </div>
            </div>
            <p className="board-intro">
              Crea una partida y comparte el código con tu rival. Las jugadas
              llegan al instante y el servidor comprueba cada una con las reglas
              oficiales.
            </p>
            <OnlinePlay />
          </section>
        )}

        {ACCOUNTS_AVAILABLE && (
          <section className="board-section" id="cuenta">
            <div className="section-heading">
              <div>
                <span className="eyebrow">TU CUENTA</span>
                <h2>Guarda tu progreso</h2>
              </div>
            </div>
            <AccountPanel />
          </section>
        )}

        <footer className="page-footer">
          <span>SHŌGI · APRENDE, PIENSA, JUEGA</span>
          <span>一歩ずつ — Un paso a la vez</span>
        </footer>
      </main>
    </div>
  )
}

export default App
