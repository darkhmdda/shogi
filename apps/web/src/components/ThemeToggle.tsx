import { useTheme, type ThemeChoice } from '../theme'

const OPTIONS: { value: ThemeChoice; icon: string; label: string }[] = [
  { value: 'auto', icon: '◐', label: 'Automático (como el sistema)' },
  { value: 'light', icon: '☀', label: 'Claro' },
  { value: 'dark', icon: '☾', label: 'Oscuro' },
]

/** Selector de tema: automático, claro u oscuro. */
export default function ThemeToggle() {
  const [theme, setTheme] = useTheme()

  return (
    <div className="theme-toggle" role="radiogroup" aria-label="Tema de colores">
      {OPTIONS.map((option) => (
        <button
          type="button"
          key={option.value}
          role="radio"
          aria-checked={theme === option.value}
          aria-label={option.label}
          title={option.label}
          className={theme === option.value ? 'active' : ''}
          onClick={() => setTheme(option.value)}
        >
          <span aria-hidden="true">{option.icon}</span>
        </button>
      ))}
    </div>
  )
}
