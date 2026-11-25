import AsyncStorage from '@react-native-async-storage/async-storage'
import { useMemo, useSyncExternalStore } from 'react'
import { useColorScheme } from 'react-native'

/** Colores de la interfaz. El tablero y las piezas son de madera en los dos temas. */
const light = {
  background: '#f5f3ee',
  surface: '#fffdf8',
  surfaceAlt: '#fbf7ee',
  border: '#e4d6bd',
  inputBorder: '#cdbb9a',
  text: '#292c26',
  muted: '#777164',
  accent: '#a84739',
  onAccent: '#fffaf0',
  button: '#f5efe4',
  buttonBorder: '#b9ad98',
  buttonText: '#3f3023',
  primary: '#2563eb',
  primaryBorder: '#2459a9',
  onPrimary: '#ffffff',
  sente: '#2563eb',
  gote: '#dc2626',
  success: '#1f4d29',
  successBg: '#eef6ee',
  successBorder: '#2f6b3a',
  error: '#9a3412',
  errorBg: '#fff1ec',
  handBg: '#fffaf0',
  coordinates: '#55442f',
  // Tablero (igual en los dos temas).
  wood: '#ead6ad',
  woodLine: '#8e704a',
  piece: '#f7edda',
  pieceText: '#3f3023',
  promoted: '#b03a2b',
  handPiece: '#f0d9b5',
  handPieceText: '#222222',
  lastMove: '#e9d48f',
  check: '#f8b4a8',
  selectedSente: '#bfdbfe',
  selectedGote: '#fecaca',
  pending: '#7c3aed',
  hint: 'rgba(47,107,58,0.6)',
  hintRing: 'rgba(47,107,58,0.8)',
  shadow: '#47351f',
}

export type Colors = typeof light

const dark: Colors = {
  ...light,
  background: '#1c1914',
  surface: '#26221b',
  surfaceAlt: '#2c271f',
  border: '#433a2e',
  inputBorder: '#5c5141',
  text: '#ece6da',
  muted: '#a69d8c',
  accent: '#d06a5a',
  button: '#332d24',
  buttonBorder: '#5c5141',
  buttonText: '#ece6da',
  primary: '#3b74e8',
  primaryBorder: '#5b8def',
  sente: '#6b9cf5',
  gote: '#f07a7a',
  success: '#9ad9a4',
  successBg: '#1d3123',
  successBorder: '#6fbf7c',
  error: '#f2a98d',
  errorBg: '#3a221b',
  handBg: '#26221b',
  coordinates: '#c9b89a',
}

export type ThemeChoice = 'auto' | 'light' | 'dark'

const KEY = 'shogi.theme'
let choice: ThemeChoice = 'auto'
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Carga el tema elegido. Se llama una vez al arrancar. */
export async function loadTheme(): Promise<void> {
  try {
    const value = await AsyncStorage.getItem(KEY)
    if (value === 'light' || value === 'dark') {
      choice = value
      listeners.forEach((listener) => listener())
    }
  } catch {
    // Sin almacenamiento: tema automático.
  }
}

export function setTheme(next: ThemeChoice) {
  choice = next
  listeners.forEach((listener) => listener())
  const write = next === 'auto' ? AsyncStorage.removeItem(KEY) : AsyncStorage.setItem(KEY, next)
  write.catch(() => {})
}

export function useThemeChoice(): ThemeChoice {
  return useSyncExternalStore(subscribe, () => choice)
}

/** ¿Está activo el tema oscuro? (elegido, o automático con el sistema en oscuro). */
export function useIsDark(): boolean {
  const selected = useThemeChoice()
  const system = useColorScheme()
  return selected === 'dark' || (selected === 'auto' && system === 'dark')
}

export function useColors(): Colors {
  return useIsDark() ? dark : light
}

/** Estilos que dependen de los colores del tema (se recalculan al cambiarlo). */
export function useStyles<T>(factory: (colors: Colors) => T): T {
  const colors = useColors()
  return useMemo(() => factory(colors), [factory, colors])
}

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 }
