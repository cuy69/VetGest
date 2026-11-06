import { useColorScheme, type TextStyle } from 'react-native'
import { usePrefs } from './lib/prefs'
import type { AppointmentStage } from './lib/types'

// Tema «cálido» de la app de propietarios (design-system/vetgest/pages/app-propietario.md):
// crema + teal de la marca + acento durazno. Contrastes comprobados en __tests__/theme.test.ts:
// texto ≥ 4.5:1 (≥ 7:1 en alto contraste) y bordes de campos ≥ 3:1.
const light = {
  scheme: 'light' as 'light' | 'dark', highContrast: false,
  primary: '#0d5953', primaryHover: '#0a4843', onPrimary: '#ffffff',
  accent: '#f6c38a', onAccent: '#3b2104', accentSoft: '#fdebd5', onAccentSoft: '#7a3d07',
  hero: '#0d5953', onHero: '#ffffff', onHeroMuted: '#cfe7e3',
  background: '#f7f3ec', card: '#ffffff', text: '#1d2b2d', textSecondary: '#59605f', border: '#e6ddd0', inputBorder: '#8a8073',
  danger: '#b0281f', dangerSoft: '#fdecea', success: '#1e6a3a', successSoft: '#e3f2e7',
  soft: '#f1ebe1', inputBackground: '#ffffff', overlay: 'rgba(13, 40, 38, 0.5)',
}
export type Theme = typeof light
const dark: Theme = {
  scheme: 'dark', highContrast: false,
  primary: '#73d4c7', primaryHover: '#96e1d7', onPrimary: '#06201d',
  accent: '#f6c38a', onAccent: '#2b1703', accentSoft: '#3a2814', onAccentSoft: '#f8cf9f',
  hero: '#173c38', onHero: '#edf3f2', onHeroMuted: '#b8d6d1',
  background: '#111716', card: '#1a2221', text: '#edf3f2', textSecondary: '#a9b7b4', border: '#33403d', inputBorder: '#7d8d8a',
  danger: '#ff8f85', dangerSoft: '#3b1714', success: '#93d9a8', successSoft: '#15301f',
  soft: '#232d2b', inputBackground: '#151c1b', overlay: 'rgba(0, 0, 0, 0.65)',
}
const lightContrast: Theme = {
  ...light, highContrast: true,
  primary: '#063f3a', primaryHover: '#042d29', onAccent: '#000000', onAccentSoft: '#4f2600',
  hero: '#063f3a', onHeroMuted: '#ffffff',
  background: '#ffffff', text: '#000000', textSecondary: '#2e3433', border: '#6b6358', inputBorder: '#3d372f',
  danger: '#8a1810', success: '#0f4a26',
}
const darkContrast: Theme = {
  ...dark, highContrast: true,
  primary: '#9ff1e5', primaryHover: '#c2f7ef', onPrimary: '#000000',
  accent: '#ffd29f', onAccent: '#000000', onAccentSoft: '#ffe1bd',
  hero: '#0b2b28', onHero: '#ffffff', onHeroMuted: '#ffffff',
  background: '#000000', card: '#0b0f0e', text: '#ffffff', textSecondary: '#dce6e4', border: '#9aaba7', inputBorder: '#c9d6d3',
  danger: '#ffb0a8', success: '#b5f0c6', soft: '#18201e', inputBackground: '#000000',
}
export const palettes = { light, dark, lightContrast, darkContrast }

/** Radio de tarjetas (20) y de botones y campos (14): formas suaves, amables. */
export const radius = 20
export const controlRadius = 14
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 }
/** Altura mínima de cualquier control táctil (pt). */
export const touch = 48
export const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 }

export function useTheme(): Theme {
  const system = useColorScheme()
  const { prefs } = usePrefs()
  const scheme = prefs.theme === 'system' ? (system === 'dark' ? 'dark' : 'light') : prefs.theme
  if (scheme === 'dark') return prefs.contrast ? darkContrast : dark
  return prefs.contrast ? lightContrast : light
}

// ---------- Tipografía: Nunito + preferencias de tamaño, negrita y espaciado ----------
export type Weight = 400 | 600 | 700 | 800
const families: Record<Weight, string> = { 400: 'Nunito_400Regular', 600: 'Nunito_600SemiBold', 700: 'Nunito_700Bold', 800: 'Nunito_800ExtraBold' }
const heavier: Record<Weight, Weight> = { 400: 600, 600: 700, 700: 800, 800: 800 }

export function toWeight(value: TextStyle['fontWeight']): Weight {
  const n = value === 'bold' ? 700 : Number(value ?? 400)
  return n >= 800 ? 800 : n >= 700 ? 700 : n >= 500 ? 600 : 400
}

/** Estilo de texto: tamaño × preferencia, interlineado 1.5 con «espaciado de lectura» (WCAG 1.4.12). */
export function typeStyle(size: number, weight: Weight, lineHeight: number, opts: { scale: number; bold: boolean; spacing: boolean; fontsReady: boolean }): TextStyle {
  const w = opts.bold ? heavier[weight] : weight
  const fontSize = Math.round(size * opts.scale * 10) / 10
  const ratio = opts.spacing ? Math.max(lineHeight / size, 1.5) * 1.15 : lineHeight / size
  return {
    fontSize, lineHeight: Math.round(fontSize * ratio),
    ...(opts.spacing ? { letterSpacing: Math.round(fontSize * 0.05 * 10) / 10 } : {}),
    // Con la fuente cargada el peso lo da la familia (evita negrita sintética); sin ella, el del sistema.
    ...(opts.fontsReady ? { fontFamily: families[w], fontWeight: 'normal' as const } : { fontWeight: String(w) as TextStyle['fontWeight'] }),
  }
}

export function useType() {
  const { prefs, system, fontsReady } = usePrefs()
  const opts = { scale: prefs.text, bold: prefs.bold || system.bold, spacing: prefs.spacing, fontsReady }
  return (size: number, weight: Weight = 400, lineHeight = Math.round(size * 1.45)) => typeStyle(size, weight, lineHeight, opts)
}

export type Tone = { bg: string; fg: string }
// Tonos de MASTER §3: ámbar, azul, lima, teal, verde, gris, rojo.
const stageLight: Record<AppointmentStage, Tone> = {
  'Por confirmar': { bg: '#fff1d6', fg: '#734a00' },
  Confirmada: { bg: '#e3eefc', fg: '#1f4f8f' },
  'En sala de espera': { bg: '#eef8c9', fg: '#3a4f06' },
  'En consulta': { bg: '#dcefed', fg: '#0d4f49' },
  Atendida: { bg: '#e2f4e6', fg: '#1e5f37' },
  Cancelada: { bg: '#eeece8', fg: '#4f5554' },
  'No asistió': { bg: '#fdecea', fg: '#a3241c' },
}
const stageDark: Record<AppointmentStage, Tone> = {
  'Por confirmar': { bg: '#3b2e0c', fg: '#ffd88a' },
  Confirmada: { bg: '#16304f', fg: '#a9c9f5' },
  'En sala de espera': { bg: '#2e3b0e', fg: '#c6e36b' },
  'En consulta': { bg: '#123c38', fg: '#7fd6cb' },
  Atendida: { bg: '#173226', fg: '#9fdcae' },
  Cancelada: { bg: '#2a302f', fg: '#c3cbc9' },
  'No asistió': { bg: '#3b1714', fg: '#ff9d94' },
}
export const stageTones = { light: stageLight, dark: stageDark }
export const stageTone = (theme: Theme, stage: AppointmentStage) => (theme.scheme === 'dark' ? stageDark : stageLight)[stage]
export const toneOf = (theme: Theme, tone: 'neutral' | 'success' | 'danger' | 'warning'): Tone => ({
  neutral: { bg: theme.soft, fg: theme.text },
  success: { bg: theme.successSoft, fg: theme.success },
  danger: { bg: theme.dangerSoft, fg: theme.danger },
  warning: stageTone(theme, 'Por confirmar'),
})[tone]

/** Cifras tabulares para horas y montos. */
export const tabular = { fontVariant: ['tabular-nums' as const] }
