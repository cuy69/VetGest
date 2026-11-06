import { useEffect, useId, useRef, type ReactNode } from 'react'
import { usePageTitle } from '../lib/usePageTitle'
import type { UseQueryResult } from '@tanstack/react-query'
import { AlertCircle, ArrowLeft, Armchair, BadgeCheck, Bird, CalendarCheck, Cat, CircleCheck, CircleX, Clock, Dog, LoaderCircle, PawPrint, RefreshCw, Stethoscope, TriangleAlert, UserX, Wallet, X, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { stageOf, timeOnly } from '../lib/format'
import { useNow } from '../lib/useNow'
import type { Availability } from '../lib/types'

export function Brand() {
  return <Link className="brand" to="/" aria-label="VetGest, inicio"><span className="brand-mark"><PawPrint size={23} strokeWidth={2.4} /></span><span>vet<span className="brand-light">gest</span><span className="brand-period">.</span></span></Link>
}
export const petPhoto = 'https://images.unsplash.com/photo-1450778869180-41d0601e046e?auto=format&fit=crop&w=1600&q=85'
export function PetIcon({ species, size = 30 }: { species: string; size?: number }) {
  const Icon = species === 'Gato' ? Cat : species === 'Perro' ? Dog : species === 'Ave' ? Bird : PawPrint
  return <Icon size={size} strokeWidth={1.6} aria-hidden="true" />
}
export function Loading({ label = 'Cargando tus datos…' }: { label?: string }) {
  return <div className="state" role="status"><LoaderCircle className="spin" size={26} /><p>{label}</p></div>
}
export function ErrorState({ error, retry, title = 'No pudimos completar la solicitud' }: { error: Error | null; retry?: () => void; title?: string }) {
  return <div className="error-state" role="alert"><AlertCircle size={23} /><div><strong>{title}</strong><p>{error?.message ?? 'Inténtalo nuevamente en unos momentos.'}</p>{retry && <button className="button secondary small" onClick={retry}>Volver a intentar</button>}</div></div>
}
export function EmptyState({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <div className="empty-state"><span className="empty-icon"><PawPrint size={30} /></span><h3>{title}</h3><p>{children}</p>{action}</div>
}
export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  usePageTitle(title)
  // tabIndex -1: el Layout mueve aquí el foco al cambiar de pantalla.
  return <div className="page-heading"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1 tabIndex={-1}>{title}</h1>{description && <p className="muted">{description}</p>}</div>{action}</div>
}
export function Field({ id, label, error, hint, children, full = false }: { id: string; label: string; error?: string; hint?: string; children: ReactNode; full?: boolean }) {
  return <div className={`field ${full ? 'full' : ''}`}><label htmlFor={id}>{label}</label>{children}{hint && <span className="field-hint" id={`${id}-hint`}>{hint}</span>}{error && <span className="field-error" role="alert" id={`${id}-error`}>{error}</span>}</div>
}
export function Notice({ children }: { children: ReactNode }) { return <div className="notice" role="status">{children}</div> }
export function Back({ to, children }: { to: string; children: ReactNode }) { return <Link to={to} className="back-link"><ArrowLeft size={17} />{children}</Link> }
const badgeTone: Record<string, string> = {
  Pendiente: 'pending', 'Por confirmar': 'pending', Confirmada: 'confirmed', 'En sala de espera': 'waiting', 'En consulta': 'consult',
  Atendida: 'attended', Cancelada: 'cancelled', 'No asistió': 'noshow', Activa: 'attended', Suspendida: 'cancelled', Inactivo: 'cancelled',
  Pagada: 'attended', 'Por cobrar': 'pending', Anulado: 'cancelled', 'Stock bajo': 'noshow', 'Sin stock': 'noshow', 'Con stock': 'attended',
}
/** Estados con texto + icono + color (MASTER §3). */
const badgeIcon: Record<string, LucideIcon> = {
  Pendiente: Clock, 'Por confirmar': Clock, Confirmada: CalendarCheck, 'En sala de espera': Armchair, 'En consulta': Stethoscope,
  Atendida: CircleCheck, Cancelada: CircleX, 'No asistió': UserX, 'Por cobrar': Wallet, Pagada: BadgeCheck, Anulado: CircleX,
  'Stock bajo': TriangleAlert, 'Sin stock': TriangleAlert, 'Con stock': CircleCheck, Activa: CircleCheck, Inactivo: CircleX, Suspendida: CircleX,
}
export function Badge({ status, label }: { status: string; label?: string }) {
  const Icon = badgeIcon[status]
  return <span className={`badge ${badgeTone[status] ?? 'owner-badge'}`}>{Icon && <Icon size={15} strokeWidth={2} aria-hidden="true" />}{label ?? (status === 'Pendiente' ? 'Por confirmar' : status)}</span>
}

const STEPS = ['Por confirmar', 'Confirmada', 'En sala de espera', 'En consulta', 'Atendida'] as const
/** Línea de 5 pasos de la cita; el paso actual se indica con texto, no solo color. */
export function StageTimeline({ appointment }: { appointment: Parameters<typeof stageOf>[0] }) {
  const stage = stageOf(appointment)
  const current = STEPS.indexOf(stage as typeof STEPS[number])
  if (current < 0) return <p className="stage-off"><Badge status={stage} /></p>
  return <ol className="stage-line" aria-label="Recorrido de la cita">{STEPS.map((step, i) => {
    const Icon = badgeIcon[step]
    const state = i < current ? 'done' : i === current ? 'current' : 'next'
    return <li key={step} className={state} aria-current={i === current ? 'step' : undefined}><span className="stage-dot"><Icon size={16} aria-hidden="true" /></span><span className="stage-name">{step}</span>{i === current && <small>Estado actual</small>}{i < current && <span className="sr-only"> (completado)</span>}</li>
  })}</ol>
}

/** «Actualizado hace X min» para datos en vivo (MASTER §4.7). */
export function LiveNote({ updatedAt }: { updatedAt: number }) {
  const now = useNow()
  const minutes = updatedAt ? Math.max(0, Math.floor((now - updatedAt) / 60_000)) : 0
  return <span className="live-note"><RefreshCw size={14} aria-hidden="true" />{minutes < 1 ? 'Actualizado hace menos de 1 min' : `Actualizado hace ${minutes} min`} · cada 30 s</span>
}
export function ConfirmDialog({ open, title, children, confirmLabel, pending, onCancel, onConfirm, error, cancelLabel = 'Volver', tone = 'danger' }: {
  open: boolean; title: string; children: ReactNode; confirmLabel: string;
  pending: boolean; onCancel: () => void; onConfirm: () => void; error?: Error | null; cancelLabel?: string; tone?: 'danger' | 'primary';
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const uid = useId()
  useEffect(() => { if (open && !ref.current?.open) ref.current?.showModal(); else if (!open) ref.current?.close() }, [open])
  return <dialog ref={ref} aria-labelledby={`${uid}-title`} aria-describedby={`${uid}-description`} onCancel={e => { e.preventDefault(); if (!pending) onCancel() }}>
    <button className="icon-button dialog-close" aria-label="Cerrar confirmación" disabled={pending} onClick={onCancel}><X size={20} /></button>
    <span className={`dialog-icon ${tone}`}>{tone === 'danger' ? <AlertCircle size={28} /> : <Wallet size={28} />}</span><h2 id={`${uid}-title`}>{title}</h2><div id={`${uid}-description`} className="muted">{children}</div>
    {error && <ErrorState error={error} />}
    <div className="form-actions"><button autoFocus className="button secondary" disabled={pending} onClick={onCancel}>{cancelLabel}</button><button className={`button ${tone === 'danger' ? 'danger' : ''}`} disabled={pending} onClick={onConfirm}>{pending ? 'Procesando…' : confirmLabel}</button></div>
  </dialog>
}

/** Turnos de 30 min; los no disponibles se muestran deshabilitados y no se pueden elegir. */
export function SlotPicker({ id, label, query, value, onChange, error, emptyText = 'No hay turnos para este día. Puede que la veterinaria no atienda o que el servicio no quepa antes del cierre.' }: {
  id: string; label: string; query: UseQueryResult<Availability>; value: string; onChange: (startsAt: string) => void; error?: string; emptyText?: string;
}) {
  if (query.fetchStatus === 'idle' && query.isPending) return null
  if (query.isPending) return <Loading label="Buscando horarios disponibles…" />
  if (query.isError) return <ErrorState error={query.error} retry={() => void query.refetch()} />
  const slots = query.data.slots
  const free = slots.filter(s => s.available).length
  return <fieldset className="slot-picker" aria-describedby={error ? `${id}-error` : `${id}-hint`}>
    <legend>{label}</legend>
    {!slots.length ? <p className="muted" id={`${id}-hint`}>{emptyText}</p> : <>
      <p className="field-hint" id={`${id}-hint`}>{free ? `${free} de ${slots.length} turnos libres. Hora de Lima (UTC−5).` : 'Todos los turnos de este día están ocupados. Prueba con otra fecha.'}</p>
      <div className="slot-grid">{slots.map(s => {
        const selected = value === s.starts_at
        return <button key={s.starts_at} type="button" className={`slot ${selected ? 'selected' : ''}`} aria-pressed={selected} disabled={!s.available}
          aria-label={`${timeOnly(s.starts_at)}${s.available ? '' : ', no disponible'}`} onClick={() => s.available && onChange(s.starts_at)}>{timeOnly(s.starts_at)}</button>
      })}</div></>}
    {error && <span className="field-error" role="alert" id={`${id}-error`}>{error}</span>}
  </fieldset>
}
