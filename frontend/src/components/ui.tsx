import { useEffect, useRef, type ReactNode } from 'react'
import { AlertCircle, ArrowLeft, Bird, Cat, Dog, LoaderCircle, PawPrint, X } from 'lucide-react'
import { Link } from 'react-router-dom'

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
export function ErrorState({ error, retry }: { error: Error | null; retry?: () => void }) {
  return <div className="error-state" role="alert"><AlertCircle size={23} /><div><strong>No pudimos completar la solicitud</strong><p>{error?.message ?? 'Inténtalo nuevamente en unos momentos.'}</p>{retry && <button className="button secondary small" onClick={retry}>Volver a intentar</button>}</div></div>
}
export function EmptyState({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <div className="empty-state"><span className="empty-icon"><PawPrint size={30} /></span><h3>{title}</h3><p>{children}</p>{action}</div>
}
export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="page-heading"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p className="muted">{description}</p>}</div>{action}</div>
}
export function Field({ id, label, error, hint, children, full = false }: { id: string; label: string; error?: string; hint?: string; children: ReactNode; full?: boolean }) {
  return <div className={`field ${full ? 'full' : ''}`}><label htmlFor={id}>{label}</label>{children}{hint && <span className="field-hint" id={`${id}-hint`}>{hint}</span>}{error && <span className="field-error" role="alert" id={`${id}-error`}>{error}</span>}</div>
}
export function Notice({ children }: { children: ReactNode }) { return <div className="notice" role="status">{children}</div> }
export function Back({ to, children }: { to: string; children: ReactNode }) { return <Link to={to} className="back-link"><ArrowLeft size={17} />{children}</Link> }
export function Badge({ status }: { status: string }) { return <span className={`badge ${status === 'Pendiente' ? 'pending' : 'cancelled'}`}>{status}</span> }
export function ConfirmDialog({ open, title, children, confirmLabel, pending, onCancel, onConfirm, error }: {
  open: boolean; title: string; children: ReactNode; confirmLabel: string;
  pending: boolean; onCancel: () => void; onConfirm: () => void; error?: Error | null;
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { if (open && !ref.current?.open) ref.current?.showModal(); else if (!open) ref.current?.close() }, [open])
  return <dialog ref={ref} aria-labelledby="confirm-title" aria-describedby="confirm-description" onCancel={e => { e.preventDefault(); if (!pending) onCancel() }}>
    <button className="icon-button dialog-close" aria-label="Cerrar confirmación" disabled={pending} onClick={onCancel}><X size={20} /></button>
    <span className="dialog-icon"><AlertCircle size={28} /></span><h2 id="confirm-title">{title}</h2><div id="confirm-description" className="muted">{children}</div>
    {error && <ErrorState error={error} />}
    <div className="form-actions"><button autoFocus className="button secondary" disabled={pending} onClick={onCancel}>Volver</button><button className="button danger" disabled={pending} onClick={onConfirm}>{pending ? 'Procesando…' : confirmLabel}</button></div>
  </dialog>
}
