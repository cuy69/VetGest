/**
 * Preferencias de lectura por dispositivo (misma idea que el menú «Accesibilidad» de la web).
 * Los valores por defecto no cambian nada; los ajustes del sistema (texto en negrita y reducir
 * movimiento) se respetan siempre, además de lo que la persona elija aquí.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AccessibilityInfo } from 'react-native'
import { prefsStorage } from './prefs-storage'

export type ThemeChoice = 'system' | 'light' | 'dark'
export const TEXT_SCALES = [1, 1.2, 1.4, 1.6] as const
export type TextScale = (typeof TEXT_SCALES)[number]
export interface Prefs { theme: ThemeChoice; text: TextScale; contrast: boolean; bold: boolean; spacing: boolean; motion: boolean }
export const defaultPrefs: Prefs = { theme: 'system', text: 1, contrast: false, bold: false, spacing: false, motion: false }

/** Lee lo guardado sin confiar en su forma: un valor raro vuelve al predeterminado. */
export function parsePrefs(raw: string | null): Prefs {
  try {
    const saved = JSON.parse(raw ?? 'null') as Partial<Record<keyof Prefs, unknown>> | null
    if (!saved || typeof saved !== 'object') return defaultPrefs
    const flag = (key: 'contrast' | 'bold' | 'spacing' | 'motion') => typeof saved[key] === 'boolean' ? saved[key] as boolean : defaultPrefs[key]
    return {
      theme: (['system', 'light', 'dark'] as const).find(v => v === saved.theme) ?? defaultPrefs.theme,
      text: TEXT_SCALES.find(v => v === saved.text) ?? defaultPrefs.text,
      contrast: flag('contrast'), bold: flag('bold'), spacing: flag('spacing'), motion: flag('motion'),
    }
  } catch {
    return defaultPrefs
  }
}

type System = { bold: boolean; reduceMotion: boolean }
type Value = { prefs: Prefs; setPrefs: (next: Prefs) => void; system: System; fontsReady: boolean }
const PrefsContext = createContext<Value>({ prefs: defaultPrefs, setPrefs: () => undefined, system: { bold: false, reduceMotion: false }, fontsReady: false })

function useSystemSetting(read: () => Promise<boolean>, event: 'boldTextChanged' | 'reduceMotionChanged') {
  const [value, setValue] = useState(false)
  useEffect(() => {
    let alive = true
    void read().then(v => { if (alive) setValue(v) }).catch(() => undefined)
    const sub = AccessibilityInfo.addEventListener(event, setValue)
    return () => { alive = false; sub?.remove() }
  }, [read, event])
  return value
}
const readBold = () => AccessibilityInfo.isBoldTextEnabled?.() ?? Promise.resolve(false)
const readMotion = () => AccessibilityInfo.isReduceMotionEnabled()

export function PrefsProvider({ children, fontsReady = false }: { children: ReactNode; fontsReady?: boolean }) {
  const [prefs, setState] = useState(defaultPrefs)
  useEffect(() => { void prefsStorage.get().then(raw => setState(parsePrefs(raw))).catch(() => undefined) }, [])
  const bold = useSystemSetting(readBold, 'boldTextChanged')
  const reduceMotion = useSystemSetting(readMotion, 'reduceMotionChanged')
  const value = useMemo<Value>(() => ({
    prefs, fontsReady, system: { bold, reduceMotion },
    setPrefs: next => { setState(next); void prefsStorage.set(JSON.stringify(next)).catch(() => undefined) },
  }), [prefs, fontsReady, bold, reduceMotion])
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>
}

export const usePrefs = () => useContext(PrefsContext)
/** Reducir movimiento: lo pidió aquí o en el sistema (WCAG 2.3.3). */
export const useReduceMotion = () => { const { prefs, system } = usePrefs(); return prefs.motion || system.reduceMotion }
