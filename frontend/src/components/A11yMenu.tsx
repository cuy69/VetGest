import { useEffect, useRef, useState } from 'react'
import { Accessibility, RotateCcw, X } from 'lucide-react'
import { applyPrefs, defaultPrefs, loadPrefs, savePrefs, type A11yPrefs, type TextScale } from '../lib/a11y'

const sizes: { value: TextScale; label: string; sample: string }[] = [
  { value: '1', label: 'Normal', sample: '100 %' },
  { value: '1.25', label: 'Grande', sample: '125 %' },
  { value: '1.5', label: 'Muy grande', sample: '150 %' },
  { value: '2', label: 'Máximo', sample: '200 %' },
]
const toggles: { key: Exclude<keyof A11yPrefs, 'text'>; label: string; hint: string }[] = [
  { key: 'contrast', label: 'Alto contraste', hint: 'Texto más oscuro, bordes marcados y foco más visible.' },
  { key: 'underline', label: 'Subrayar enlaces', hint: 'Distingue los enlaces sin depender del color.' },
  { key: 'spacing', label: 'Espaciado de lectura', hint: 'Más espacio entre líneas, palabras y letras.' },
  { key: 'motion', label: 'Reducir animaciones', hint: 'Desactiva transiciones y movimientos.' },
]

/** Reading preferences: always one Tab away, invisible in effect until someone uses it. */
export function A11yMenu({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false)
  const [prefs, setPrefs] = useState<A11yPrefs>(loadPrefs)
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => { if (open && !dialog.current?.open) dialog.current?.showModal(); else if (!open && dialog.current?.open) dialog.current.close() }, [open])
  const update = (next: A11yPrefs) => { setPrefs(next); applyPrefs(next); savePrefs(next) }
  const close = () => { setOpen(false); trigger.current?.focus() }
  const changed = JSON.stringify(prefs) !== JSON.stringify(defaultPrefs)
  return <>
    <button ref={trigger} type="button" className={`a11y-trigger ${changed ? 'active' : ''}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
      <Accessibility size={20} aria-hidden="true" /><span className={compact ? 'sr-only' : 'a11y-trigger-label'}>Accesibilidad</span>
    </button>
    <dialog ref={dialog} className="a11y-dialog" aria-labelledby="a11y-title" onCancel={e => { e.preventDefault(); close() }} onClick={e => { if (e.target === dialog.current) close() }}>
      <button type="button" className="icon-button dialog-close" aria-label="Cerrar opciones de accesibilidad" onClick={close}><X size={20} /></button>
      <h2 id="a11y-title">Accesibilidad</h2>
      <p className="muted">Ajusta la lectura a tu medida. Se guarda en este dispositivo y se aplica al instante.</p>
      <fieldset className="a11y-sizes"><legend>Tamaño del texto</legend>
        {sizes.map(s => <label key={s.value} className={prefs.text === s.value ? 'selected' : ''}>
          <input type="radio" name="a11y-text" value={s.value} checked={prefs.text === s.value} onChange={() => update({ ...prefs, text: s.value })} />
          <span className="a11y-size-sample" style={{ fontSize: `${Math.min(Number(s.value), 1.6)}rem` }} aria-hidden="true">Aa</span><span>{s.label}<small>{s.sample}</small></span>
        </label>)}
      </fieldset>
      <fieldset className="a11y-toggles"><legend className="sr-only">Opciones de visualización</legend>
        {toggles.map(t => <label key={t.key} className="a11y-toggle">
          <input type="checkbox" role="switch" checked={prefs[t.key]} aria-describedby={`a11y-${t.key}-hint`} onChange={e => update({ ...prefs, [t.key]: e.target.checked })} />
          <span><strong>{t.label}</strong><small id={`a11y-${t.key}-hint`}>{t.hint}</small></span>
        </label>)}
      </fieldset>
      <p className="a11y-tip">También puedes usar el zoom del navegador (Ctrl o ⌘ y +) hasta 400 %: la página se reorganiza sin desplazamiento horizontal.</p>
      <div className="form-actions"><button type="button" className="button secondary" disabled={!changed} onClick={() => update(defaultPrefs)}><RotateCcw size={17} />Restablecer</button><button type="button" className="button" onClick={close}>Listo</button></div>
    </dialog>
  </>
}
