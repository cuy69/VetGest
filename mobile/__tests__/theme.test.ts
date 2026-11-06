import { parsePrefs, defaultPrefs } from '@/lib/prefs'
import { palettes, stageTones, typeStyle, toWeight } from '@/theme'

const lum = (hex: string) => {
  const [r, g, b] = hex.slice(1).match(/../g)!.map(x => parseInt(x, 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }

describe('contraste del tema (WCAG 1.4.3, 1.4.6 y 1.4.11)', () => {
  const text: [string, string][] = [
    ['text', 'background'], ['text', 'card'], ['textSecondary', 'background'], ['textSecondary', 'card'], ['textSecondary', 'soft'],
    ['primary', 'background'], ['primary', 'card'], ['primary', 'soft'], ['onPrimary', 'primary'], ['onAccent', 'accent'],
    ['onAccentSoft', 'accentSoft'], ['danger', 'card'], ['danger', 'dangerSoft'], ['success', 'successSoft'], ['onHero', 'hero'], ['onHeroMuted', 'hero'],
  ]
  for (const [name, theme] of Object.entries(palettes)) {
    const min = theme.highContrast ? 7 : 4.5
    it(`${name}: texto ≥ ${min}:1 y bordes de campos ≥ 3:1`, () => {
      const t = theme as unknown as Record<string, string>
      for (const [fg, bg] of text) expect([fg, bg, ratio(t[fg], t[bg]) >= min]).toEqual([fg, bg, true])
      expect(ratio(t.inputBorder, t.card)).toBeGreaterThanOrEqual(3)
      expect(ratio(t.inputBorder, t.background)).toBeGreaterThanOrEqual(3)
    })
  }
  it('estados de las citas ≥ 4.5:1 en claro y oscuro', () => {
    for (const tones of Object.values(stageTones)) for (const [stage, { bg, fg }] of Object.entries(tones)) expect([stage, ratio(fg, bg) >= 4.5]).toEqual([stage, true])
  })
})

describe('preferencias de lectura', () => {
  it('lo guardado inválido vuelve al predeterminado', () => {
    expect(parsePrefs(null)).toEqual(defaultPrefs)
    expect(parsePrefs('no es json')).toEqual(defaultPrefs)
    expect(parsePrefs('{"theme":"rosa","text":3,"contrast":"sí"}')).toEqual(defaultPrefs)
    expect(parsePrefs('{"theme":"dark","text":1.4,"contrast":true,"bold":true,"spacing":false,"motion":true}'))
      .toEqual({ theme: 'dark', text: 1.4, contrast: true, bold: true, spacing: false, motion: true })
  })
  it('tamaño, negrita y espaciado de lectura (interlineado ≥ 1.5)', () => {
    const base = { scale: 1, bold: false, spacing: false, fontsReady: true }
    expect(typeStyle(16, 400, 24, base)).toMatchObject({ fontSize: 16, lineHeight: 24, fontFamily: 'Nunito_400Regular' })
    expect(typeStyle(16, 400, 24, { ...base, scale: 1.4 })).toMatchObject({ fontSize: 22.4, lineHeight: 34 })
    expect(typeStyle(16, 600, 24, { ...base, bold: true }).fontFamily).toBe('Nunito_700Bold')
    const spaced = typeStyle(20, 700, 26, { ...base, spacing: true })
    expect(spaced.lineHeight! / 20).toBeGreaterThanOrEqual(1.5)
    expect(spaced.letterSpacing).toBe(1)
    // Sin la fuente cargada, el peso lo da el sistema.
    expect(typeStyle(16, 700, 24, { ...base, fontsReady: false })).toMatchObject({ fontWeight: '700' })
    expect(toWeight('bold')).toBe(700)
    expect(toWeight('500')).toBe(600)
  })
})
