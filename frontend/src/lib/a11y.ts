/**
 * Per-device reading preferences. Defaults change nothing, so people who don't need them
 * get the regular interface; the operating system's own settings (font size, contrast,
 * reduced motion) are honoured automatically through CSS.
 */
export type TextScale = '1' | '1.25' | '1.5' | '2'
export interface A11yPrefs { text: TextScale; contrast: boolean; underline: boolean; spacing: boolean; motion: boolean }
const prefers = (query: string) => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches
// Defaults follow the operating system: someone who already asked for more contrast or less motion gets it here too.
export const defaultPrefs: A11yPrefs = { text: '1', contrast: prefers('(prefers-contrast: more)'), underline: false, spacing: false, motion: prefers('(prefers-reduced-motion: reduce)') }
const KEY = 'vetgest:a11y'

export function loadPrefs(): A11yPrefs {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<A11yPrefs> | null
    if (!saved || typeof saved !== 'object') return defaultPrefs
    const flag = (key: Exclude<keyof A11yPrefs, 'text'>) => typeof saved[key] === 'boolean' ? saved[key] : defaultPrefs[key]
    const text = (['1', '1.25', '1.5', '2'] as const).find(v => v === saved.text) ?? defaultPrefs.text
    return { text, contrast: flag('contrast'), underline: flag('underline'), spacing: flag('spacing'), motion: flag('motion') }
  } catch {
    return defaultPrefs
  }
}

export function savePrefs(prefs: A11yPrefs) {
  try { localStorage.setItem(KEY, JSON.stringify(prefs)) } catch { /* private mode: settings last for this visit */ }
}

export function applyPrefs(prefs: A11yPrefs) {
  const root = document.documentElement
  root.dataset.text = prefs.text
  const flags: [keyof A11yPrefs, string][] = [['contrast', 'contrast'], ['underline', 'underline'], ['spacing', 'spacing'], ['motion', 'reduceMotion']]
  for (const [pref, attr] of flags) {
    if (prefs[pref]) root.dataset[attr] = 'on'
    else delete root.dataset[attr]
  }
  syncBreakpoints()
}

/*
 * The stylesheet's breakpoints are written in px, so enlarging only the text (in-app scale
 * or a larger default font in the browser) would cram desktop layouts. We clone every
 * `max-width: Npx` rule under `:root[data-lt-N]` and switch those attributes on when the
 * viewport, measured in "text-sized" pixels, is narrower than N. Browser zoom already
 * triggers the real media queries, so in that case the clones simply agree with them.
 */
const breakpoints = new Set<number>()

function prefixSelector(selector: string, prefix: string) {
  return selector.split(',').map(part => `${prefix} ${part.trim()}`).join(', ')
}

export function installBreakpointEmulation() {
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList
    try { rules = sheet.cssRules } catch { continue } // cross-origin sheet
    const clones: string[] = []
    for (const rule of Array.from(rules)) {
      if (!(rule instanceof CSSMediaRule)) continue
      const match = /^\(max-width:\s*(\d+)px\)$/.exec(rule.conditionText.trim())
      if (!match) continue
      const width = Number(match[1])
      breakpoints.add(width)
      for (const inner of Array.from(rule.cssRules)) {
        if (inner instanceof CSSStyleRule) clones.push(`${prefixSelector(inner.selectorText, `:root[data-lt-${width}]`)} { ${inner.style.cssText} }`)
      }
    }
    for (const css of clones) {
      try { sheet.insertRule(css, sheet.cssRules.length) } catch { /* unsupported selector: skip */ }
    }
  }
  window.addEventListener('resize', syncBreakpoints)
  syncBreakpoints()
}

function syncBreakpoints() {
  const root = document.documentElement
  const scale = parseFloat(getComputedStyle(root).fontSize) / 16 || 1
  const effective = window.innerWidth / scale
  for (const width of breakpoints) {
    if (scale > 1 && effective <= width) root.setAttribute(`data-lt-${width}`, '')
    else root.removeAttribute(`data-lt-${width}`)
  }
}
