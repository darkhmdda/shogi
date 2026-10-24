
import './App.css'

const sections = [
  { icon: '⌂', label: 'Inicio', active: true },
  { icon: '書', label: 'Aprender', active: false },
  { icon: '棋', label: 'Practicar', active: false },
  { icon: '対', label: 'Jugar', active: false },
]

const features = [
  {
    number: '01',
    title: 'Aprende las piezas',
    description: 'Conoce cada pieza y descubre cómo se mueve por el tablero.',
    icon: '駒',
    action: 'Explorar piezas',
  },
  {
    number: '02',
    title: 'Practica movimientos',
    description: 'Resuelve ejercicios y mejora tu comprensión del juego.',
    icon: '歩',
    action: 'Empezar a practicar',
  },
  {
    number: '03',
    title: 'Juega una partida',
    description: 'Pon en práctica lo aprendido, movimiento a movimiento.',
    icon: '王',
    action: 'Próximamente',
  },
]

function App() {
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
              className={`nav-link ${section.active ? 'active' : ''}`}
              href={section.active ? '#inicio' : '#secciones'}
            >
              <span className="nav-icon" aria-hidden="true">{section.icon}</span>
              <span>{section.label}</span>
              {section.label === 'Jugar' && (
                <span className="nav-soon">Pronto</span>
              )}
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
          <div className="level-label">
            <span className="status-dot" />
            RUTA DEL PRINCIPIANTE
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
              <a className="button-primary" href="#secciones">
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
                  href="#secciones"
                  aria-label={`${feature.action}: ${feature.title}`}
                >
                  {feature.action} <span aria-hidden="true">→</span>
                </a>
              </article>
            ))}
          </div>
        </section>

        <footer className="page-footer">
          <span>SHŌGI · APRENDE, PIENSA, JUEGA</span>
          <span>一歩ずつ — Un paso a la vez</span>
        </footer>
      </main>
    </div>
  )
}

export default App
