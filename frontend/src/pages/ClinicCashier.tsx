import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Ban, Banknote, CreditCard, Smartphone, Wallet, type LucideIcon } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { Badge, ConfirmDialog, EmptyState, ErrorState, Field, Loading, Notice, PageHeader } from '../components/ui'
import { api, json } from '../lib/api'
import { fullName, money, personName, relativeDate, relativeDateTime, timeOnly } from '../lib/format'
import { useMe, usePayments, usePendingPayments } from '../lib/queries'
import { allowed } from '../lib/roles'
import { paymentAmountSchema, todayLima, voidSchema } from '../lib/schemas'
import type { ClinicAppointment, Payment, PaymentMethod } from '../lib/types'

const METHODS: { method: PaymentMethod; Icon: LucideIcon }[] = [
  { method: 'Efectivo', Icon: Banknote }, { method: 'Yape', Icon: Smartphone }, { method: 'Tarjeta', Icon: CreditCard },
]
interface Charge { a: ClinicAppointment; amount: number; method: PaymentMethod }

function PendingCard({ a, highlight, onCharge }: { a: ClinicAppointment; highlight: boolean; onCharge: (c: Charge) => void }) {
  const [amount, setAmount] = useState(String(a.service.price))
  const [method, setMethod] = useState<PaymentMethod | null>(null)
  const [error, setError] = useState('')
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { if (highlight) { input.current?.scrollIntoView?.({ block: 'center' }); input.current?.focus() } }, [highlight])
  const parsed = paymentAmountSchema.safeParse(amount)
  const submit = () => {
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Monto inválido.'); return }
    if (!method) { setError('Elige cómo paga: Efectivo, Yape o Tarjeta.'); return }
    setError(''); onCharge({ a, amount: parsed.data, method })
  }
  const inputId = `amount-${a.id}`
  return <li className={`pay-card ${highlight ? 'highlight' : ''}`}>
    <div><strong>{a.pet.name} · {a.service.name}</strong><small>{fullName(a.owner)} · atendida {relativeDateTime(a.starts_at)}</small></div>
    <Badge status="Por cobrar" />
    <div className="pay-controls">
      <Field id={inputId} label="Monto (S/)" error={error || undefined}><input ref={input} id={inputId} className="amount-input" type="number" inputMode="decimal" min="0.01" step="0.01" value={amount} aria-invalid={!!error} aria-describedby={error ? `${inputId}-error` : undefined} onChange={e => { setAmount(e.target.value); setError('') }} /></Field>
      <div className="method-group" role="group" aria-label={`Método de pago de ${a.pet.name}`}>{METHODS.map(({ method: m, Icon }) => <button key={m} type="button" className="method-button" aria-pressed={method === m} onClick={() => { setMethod(m); setError('') }}><Icon size={20} aria-hidden="true" />{m}</button>)}</div>
      <button className="button pay-submit" onClick={submit}><Wallet size={18} />{method && parsed.success ? `Cobrar ${money(parsed.data)} con ${method}` : 'Cobrar'}</button>
    </div>
  </li>
}

export function Cashier() {
  const me = useMe()
  const [params] = useSearchParams()
  const focusId = Number(params.get('cita')) || 0
  const [date, setDate] = useState(todayLima())
  const pending = usePendingPayments()
  const payments = usePayments(date, date)
  const client = useQueryClient()
  const [notice, setNotice] = useState('')
  const [charge, setCharge] = useState<Charge | null>(null)
  const [voiding, setVoiding] = useState<Payment | null>(null)
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState('')
  const canVoid = allowed(me.data, 'voidPayment')
  const pay = useMutation({
    mutationFn: (c: Charge) => api<Payment>('/clinic/payments', json('POST', { appointment_id: c.a.id, amount: c.amount, method: c.method, notes: '' })),
    onSuccess: async (_data, c) => { await client.invalidateQueries({ queryKey: ['clinic'] }); setNotice(`Cobro registrado: ${money(c.amount)} con ${c.method} · ${c.a.pet.name}.`); setCharge(null) },
  })
  const voidMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => api<Payment>(`/clinic/payments/${id}/void`, json('POST', { reason })),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ['clinic'] }); setNotice(`Cobro de ${voiding?.pet_name ?? 'la cita'} anulado. La cita vuelve a pendientes de cobro.`); setVoiding(null) },
  })
  const confirmVoid = () => {
    const parsed = voidSchema.safeParse({ reason })
    if (!parsed.success) { setReasonError(parsed.error.issues[0]?.message ?? 'Indica el motivo.'); return }
    setReasonError(''); if (voiding) voidMutation.mutate({ id: voiding.id, reason: parsed.data.reason })
  }
  const valid = payments.data?.filter(p => !p.voided_at) ?? []
  const total = valid.reduce((sum, p) => sum + Number(p.amount), 0)
  const byMethod = METHODS.map(({ method, Icon }) => ({ method, Icon, total: valid.filter(p => p.method === method).reduce((sum, p) => sum + Number(p.amount), 0), count: valid.filter(p => p.method === method).length }))
  const owed = (pending.data ?? []).reduce((sum, a) => sum + Number(a.service.price), 0)
  return <><PageHeader eyebrow="COBROS EN LA VETERINARIA" title="Caja" description="Cada atención termina aquí: cobra lo atendido y cuadra el día por método de pago." />
    {notice && <Notice>{notice}</Notice>}
    <section className="panel" aria-labelledby="pending-title" style={{ marginBottom: 28 }}>
      <div className="section-heading"><h2 id="pending-title">Pendientes de cobro</h2><span className="muted">{pending.data ? `${pending.data.length} · ${money(owed)}` : ''}</span></div>
      {pending.isPending ? <Loading label="Cargando atenciones por cobrar…" /> : pending.isError ? <ErrorState error={pending.error} retry={() => void pending.refetch()} /> : !pending.data.length ? <EmptyState title="Todo cobrado">Cuando un veterinario registre una atención, aparecerá aquí para cobrarla.</EmptyState>
        : <ul className="pay-list" aria-label="Atenciones por cobrar">{pending.data.map(a => <PendingCard key={a.id} a={a} highlight={a.id === focusId} onCharge={c => { pay.reset(); setCharge(c) }} />)}</ul>}
    </section>
    <section aria-labelledby="payments-title">
      <div className="section-heading" style={{ padding: '8px 0 14px', border: 0 }}><h2 id="payments-title">Cierre del día · {relativeDate(date)}</h2>
        <div className="toolbar" style={{ margin: 0 }}><Field id="payments-date" label="Día"><input id="payments-date" type="date" max={todayLima()} value={date} onChange={e => e.target.value && setDate(e.target.value)} /></Field></div></div>
      {payments.isPending ? <Loading label="Cargando cobros…" /> : payments.isError ? <ErrorState error={payments.error} retry={() => void payments.refetch()} /> : <>
        <div className="totals-row" aria-label="Totales del día">
          <div className="total-chip main"><span>Total cobrado · {valid.length} cobros</span><strong>{money(total)}</strong></div>
          {byMethod.map(m => <div className="total-chip" key={m.method}><span><m.Icon size={13} aria-hidden="true" /> {m.method} · {m.count}</span><strong>{money(m.total)}</strong></div>)}
          {date === todayLima() && <div className="total-chip"><span>Pendiente · {pending.data?.length ?? 0}</span><strong>{money(owed)}</strong></div>}
        </div>
        {!payments.data.length ? <div className="panel"><EmptyState title="Sin cobros este día">Los cobros que registres aparecerán aquí con su método para cuadrar el cajón y Yape.</EmptyState></div>
          : <div className="panel table-wrap" tabIndex={0} role="region" aria-label="Cobros del día"><table className="data-table"><thead><tr><th>Hora</th><th>Paciente</th><th>Servicio</th><th>Método</th><th>Monto</th><th>Recibió</th>{canVoid && <th><span className="sr-only">Acciones</span></th>}</tr></thead>
            <tbody>{payments.data.map(p => <tr key={p.id} className={p.voided_at ? 'voided' : ''}>
              <td>{timeOnly(p.paid_at)}</td><td><strong>{p.pet_name}</strong><small>{p.owner_name}</small></td><td>{p.service_name}</td>
              <td>{p.voided_at ? <><Badge status="Anulado" /><small>{p.method} · {p.void_reason}</small></> : <Badge status="Pagada" label={p.method} />}</td><td>{money(Number(p.amount))}</td><td>{personName(p.received_by)}</td>
              {canVoid && <td className="actions">{!p.voided_at && <button className="text-link danger-text" onClick={() => { voidMutation.reset(); setReason(''); setReasonError(''); setVoiding(p) }}><Ban size={15} />Anular<span className="sr-only"> cobro de {p.pet_name}</span></button>}</td>}
            </tr>)}</tbody></table></div>}
      </>}
    </section>
    <ConfirmDialog open={!!charge} tone="primary" title={charge ? `¿Cobrar ${money(charge.amount)} con ${charge.method}?` : ''} confirmLabel="Confirmar cobro" pending={pay.isPending} onCancel={() => setCharge(null)} onConfirm={() => charge && pay.mutate(charge)} error={pay.error}>
      {charge && <dl className="dialog-summary"><dt>Paciente</dt><dd>{charge.a.pet.name}</dd><dt>Propietario</dt><dd>{fullName(charge.a.owner)}</dd><dt>Servicio</dt><dd>{charge.a.service.name}</dd><dt>Monto</dt><dd>{money(charge.amount)}</dd><dt>Método</dt><dd>{charge.method}</dd></dl>}
    </ConfirmDialog>
    <ConfirmDialog open={!!voiding} title={`¿Anular el cobro de ${voiding?.pet_name ?? ''}?`} confirmLabel="Anular cobro" cancelLabel="Mantener" pending={voidMutation.isPending} onCancel={() => setVoiding(null)} onConfirm={confirmVoid} error={voidMutation.error}>
      <p>El cobro no se borra: queda tachado como «Anulado» con tu motivo y la cita vuelve a pendientes de cobro.</p>
      {voiding && <dl className="dialog-summary"><dt>Monto</dt><dd>{money(Number(voiding.amount))}</dd><dt>Método</dt><dd>{voiding.method}</dd><dt>Servicio</dt><dd>{voiding.service_name}</dd></dl>}
      <div className="field" style={{ marginTop: 14, textAlign: 'left' }}><label htmlFor="void-reason">Motivo de la anulación</label>
        <textarea id="void-reason" rows={3} maxLength={500} value={reason} aria-invalid={!!reasonError} aria-describedby={reasonError ? 'void-reason-error' : undefined} onChange={e => setReason(e.target.value)} />
        {reasonError && <span className="field-error" role="alert" id="void-reason-error">{reasonError}</span>}</div>
    </ConfirmDialog>
  </>
}
