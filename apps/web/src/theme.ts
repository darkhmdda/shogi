import { useEffect, useState } from 'react'

export type ThemeChoice = 'auto' | 'light' | 'dark'

const KEY = 'shogi.theme'

function read(): ThemeChoice {
  try {
    const value = window.localStorage.getItem(KEY)
    return value === 'light' || value === 'dark' ? value : 'auto'
  } catch {
    return 'auto'
  }
}

/** Tema elegido: automático (según el sistema), claro u oscuro. Se recuerda en el navegador. */
export function useTheme(): [ThemeChoice, (choice: ThemeChoice) => void] {
  const [choice, setChoice] = useState<ThemeChoice>(read)

  useEffect(() => {
    const root = document.documentElement
    if (choice === 'auto') delete root.dataset.theme
    else root.dataset.theme = choice
    try {
      if (choice === 'auto') window.localStorage.removeItem(KEY)
      else window.localStorage.setItem(KEY, choice)
    } catch {
      // Sin almacenamiento: el tema dura hasta recargar.
    }
  }, [choice])

  return [choice, setChoice]
}
