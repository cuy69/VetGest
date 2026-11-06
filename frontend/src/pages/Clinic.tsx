import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Armchair, CalendarCheck, CalendarClock, CalendarDays, Check, ClipboardPlus, Clock, Clock3, DoorOpen, Phone, Play, Save, Stethoscope, TriangleAlert, UserX, Wallet, X } from 'lucide-react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Back, Badge, ConfirmDialog, EmptyState, ErrorState, Field, LiveNote, Loading, Notice, PageHeader, PetIcon, SlotPicker } from '../components/ui'
import { api, ApiError, json } from '../lib/api'
import { dateTime, elapsed, fullName, limaParts, money, relativeDateTime, stageOf, timeOnly } from '../lib/format'
import { useAgenda, useClinicAppointment, useClinicSummary, useMe, usePendingPayments, useStaff, useStaffAvailability, type AgendaFilter } from '../lib/queries'
import { allowed, can } from '../lib/roles'
import { todayLima } from '../lib/schemas'
import type { AppointmentStatus, ClinicAppointment, StaffMember, User } from '../lib/types'
import { useNow } from '../lib/useNow'

const STATUSES: AppointmentStatus[] = ['Pendiente', 'Confirmada', 'Atendida', 'Cancelada', 'No asistió']

function AgendaTable({ items, showDate = true }: { items: ClinicAppointment[]; showDate?: boolean }) {
  return <div className="panel table-wrap" tabIndex={0} role="region" aria-label="Agenda"><table className="data-table"><thead><tr><th>{showDate ? 'Fecha y hora' : 'Hora'}</th><th>Paciente</th><th>Propietario</th><th>Servicio</th><th>Veterinario</th><th>Estado</th><th><span className="sr-only">Acciones</span></th></tr></thead>
    <tbody>{items.map(a => <tr key={a.id}>
      <td>{showDate ? dateTime(a.starts_at) : timeOnly(a.starts_at)}</td>
      <td><strong>{a.pet.name}</strong><small>{a.pet.species} · {a.pet.breed}</small></td>
      <td>{fullName(a.owner)}<small>{a.owner.phone}</small></td>
      <td>{a.service.name}</td>
      <td>{a.vet ? fullName(a.vet.profile) : <span className="muted">Por asignar</span>}</td>
      <td><Badge status={stageOf(a)} />{a.payment && <small>Pagada · {money(a.payment.amount)}</small>}</td>
      <td className="actions"><Link className="text-link" to={`/clinica/agenda/${a.id}`}>Gestionar <ArrowRight size={15} /></Link></td>
    </tr>)}</tbody></table></div>
}

/** Llegada (recepción/admin) e inicio de consulta (veterinario asignado/admin). */
function useStageAction() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, action }: { id: number; action: 'arrival' | 'start' }) => api<ClinicAppointment>(`/clinic/appointments/${id}/${action}`, json('POST')),
    onSuccess: async data => { client.setQueryData(['clinic', 'appointments', 'detail', String(data.id)], data); await client.invalidateQueries({ queryKey: ['clinic'] }) },
  })
}
const isToday = (a: ClinicAppointment) => limaParts(a.starts_at).date === todayLima()
const mayStart = (user: User | null | undefined, a: ClinicAppointment) => allowed(user, 'startConsult') && (can(user, 'admin') || a.vet?.id === user?.id)
const waitMinutes = (a: ClinicAppointment, now: number) => a.arrived_at ? Math.max(0, Math.floor((now - new Date(a.arrived_at).getTime()) / 60_000)) : 0
/** Umbral de espera (recepcion.md): ≥ 15 min ámbar, ≥ 30 min rojo, siempre con número y texto. */
function WaitTime({ a, now }: { a: ClinicAppointment; now: number }) {
  if (!a.arrived_at) return null
  const m = waitMinutes(a, now)
  return <span className={`wait-time ${m >= 30 ? 'late' : m >= 15 ? 'warn' : ''}`} title={`Llegó a las ${timeOnly(a.arrived_at)}`}>Espera {elapsed(a.arrived_at, now)}{m >= 30 ? <span className="wait-flag">· demora</span> : m >= 15 ? <span className="wait-flag">· atención</span> : null}</span>
}

function Column({ title, Icon, count, label, children, empty }: { title: string; Icon: typeof Armchair; count: number; label: string; children: React.ReactNode[]; empty: string }) {
  return <article className="panel wait-column"><h3><span className="heading-icon"><Icon size={17} aria-hidden="true" />{title}</span><strong aria-label={`${count} ${label}`}>{count}</strong></h3>
    {children.length ? <ul className="wait-list" aria-label={label}>{children}</ul> : <p className="wait-empty">{empty}</p>}</article>
}

function TodayBoard({ items, updatedAt }: { items: ClinicAppointment[]; updatedAt: number }) {
  const me = useMe()
  const user = me.data
  const now = useNow()
  const action = useStageAction()
  const cashier = allowed(user, 'cashier')
  const pending = usePendingPayments(cashier)
  const [notice, setNotice] = useState('')
  const busy = (id: number) => action.isPending && action.variables?.id === id
  const run = (a: ClinicAppointment, kind: 'arrival' | 'start') => { setNotice(''); action.mutate({ id: a.id, action: kind }, { onSuccess: () => setNotice(kind === 'arrival' ? `Llegada registrada · ${a.pet.name}` : `Consulta iniciada · ${a.pet.name}`) }) }
  const toArrive = items.filter(a => stageOf(a) === 'Confirmada').sort((x, y) => x.starts_at.localeCompare(y.starts_at))
  const waiting = items.filter(a => stageOf(a) === 'En sala de espera').sort((x, y) => (x.arrived_at ?? '').localeCompare(y.arrived_at ?? ''))
  const consult = items.filter(a => stageOf(a) === 'En consulta')
  const who = (a: ClinicAppointment) => <div><strong>{a.pet.name}</strong><small>{timeOnly(a.starts_at)} · {a.service.name}</small><small>{a.vet ? fullName(a.vet.profile) : 'Sin veterinario'}</small></div>
  return <section aria-labelledby="board-title" style={{ marginBottom: 30 }}>
    <div className="section-heading" style={{ padding: '8px 0 14px', border: 0 }}><h2 id="board-title">Recorrido de hoy</h2><LiveNote updatedAt={updatedAt} /></div>
    {notice && <Notice>{notice}</Notice>}{action.isError && <ErrorState error={action.error} />}
    <div className={`board ${cashier ? '' : 'three'}`}>
      <Column title="Por llegar" Icon={CalendarCheck} count={toArrive.length} label="Pacientes por llegar" empty="No hay citas confirmadas pendientes de llegada.">{toArrive.map(a => <li className="board-card" key={a.id}>{who(a)}
        {allowed(user, 'arrival') && <button className="button small" disabled={busy(a.id)} onClick={() => run(a, 'arrival')}><DoorOpen size={16} />{busy(a.id) ? 'Registrando…' : 'Registrar llegada'}<span className="sr-only"> de {a.pet.name}</span></button>}</li>)}</Column>
      <Column title="En sala de espera" Icon={Armchair} count={waiting.length} label="Pacientes en sala de espera" empty="Nadie espera en este momento.">{waiting.map(a => <li className="board-card" key={a.id}>{who(a)}<WaitTime a={a} now={now} />
        {mayStart(user, a) && <button className="button small" disabled={busy(a.id)} onClick={() => run(a, 'start')}><Play size={16} />{busy(a.id) ? 'Iniciando…' : 'Iniciar consulta'}<span className="sr-only"> de {a.pet.name}</span></button>}</li>)}</Column>
      <Column title="En consulta" Icon={Stethoscope} count={consult.length} label="Pacientes en consulta" empty="No hay consultas en curso.">{consult.map(a => <li className="board-card" key={a.id}>{who(a)}
        {a.started_at && <span className="wait-time">Desde las {timeOnly(a.started_at)} · {elapsed(a.started_at, now)}</span>}
        {can(user, 'admin', 'vet') && <Link className="button small secondary" to={`/clinica/pacientes/${a.pet.id}?cita=${a.id}`}><ClipboardPlus size={16} />Registrar atención</Link>}</li>)}</Column>
      {cashier && <Column title="Por cobrar" Icon={Wallet} count={pending.data?.length ?? 0} label="Atenciones por cobrar" empty={pending.isError ? 'No pudimos cargar los cobros pendientes.' : pending.isPending ? 'Cargando…' : 'Todo lo atendido está cobrado.'}>{(pending.data ?? []).map(a => <li className="board-card" key={a.id}><div><strong>{a.pet.name}</strong><small>{a.service.name} · {fullName(a.owner)}</small></div>
        <Link className="button small" to={`/clinica/caja?cita=${a.id}`}><Wallet size={16} />Cobrar {money(a.service.price)}<span className="sr-only"> a {a.pet.name}</span></Link></li>)}</Column>}
    </div>
  </section>
}

/** Solicitudes por confirmar: la más antigua primero, veterinario en la fila y aviso de cruce antes de enviar. */
function RequestRow({ a, vets }: { a: ClinicAppointment; vets: StaffMember[] }) {
  const client = useQueryClient()
  const [vetId, setVetId] = useState(a.vet ? String(a.vet.id) : '')
  const slots = useStaffAvailability({ service_id: a.service.id, date: limaParts(a.starts_at).date, vet_id: vetId ? Number(vetId) : null, exclude_appointment_id: a.id }, !!vetId)
  const slot = slots.data?.slots.find(s => new Date(s.starts_at).getTime() === new Date(a.starts_at).getTime())
  const cross = !!vetId && !!slot && !slot.available
  const vetName = vets.find(v => String(v.user_id) === vetId)
  const mutation = useMutation({
    mutationFn: () => api<ClinicAppointment>(`/clinic/appointments/${a.id}`, json('PATCH', { status: 'Confirmada', vet_id: vetId ? Number(vetId) : null })),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ['clinic'] }) },
    onError: async () => { await client.invalidateQueries({ queryKey: ['clinic', 'availability'] }) },
  })
  return <li className="request-row">
    <div><strong>{a.pet.name} · {a.service.name}</strong><small>{fullName(a.owner)} · {a.owner.phone}</small></div>
    <div><strong>{relativeDateTime(a.starts_at)}</strong><small>Solicitada {relativeDateTime(a.created_at)}</small></div>
    <div className="field"><label className="sr-only" htmlFor={`req-vet-${a.id}`}>Veterinario para {a.pet.name}</label><select id={`req-vet-${a.id}`} value={vetId} onChange={e => { setVetId(e.target.value); mutation.reset() }}><option value="">Por asignar</option>{vets.map(v => <option key={v.user_id} value={v.user_id}>{fullName(v.profile)}</option>)}</select></div>
    <div className="inline-actions"><button className="button small" disabled={mutation.isPending || cross || (!!vetId && slots.isFetching)} onClick={() => mutation.mutate()}><Check size={16} />{mutation.isPending ? 'Confirmando…' : 'Confirmar turno'}<span className="sr-only"> de {a.pet.name}</span></button><Link className="text-link" to={`/clinica/agenda/${a.id}`}>Gestionar</Link></div>
    {cross && <p className="cross-warning" role="alert"><TriangleAlert size={16} aria-hidden="true" />Cruce de horario: {vetName ? fullName(vetName.profile) : 'ese veterinario'} ya tiene otra cita a esa hora. Elige otro veterinario o reprograma.</p>}
    {mutation.isError && <p className="cross-warning" role="alert"><TriangleAlert size={16} aria-hidden="true" />{mutation.error.message}</p>}
  </li>
}
function RequestList({ items }: { items: ClinicAppointment[] }) {
  const staff = useStaff()
  const vets = staff.data?.filter(s => s.is_active && (s.role === 'vet' || s.role === 'admin')) ?? []
  const sorted = [...items].sort((x, y) => x.created_at.localeCompare(y.created_at))
  return <section className="panel" aria-labelledby="requests-title" style={{ marginBottom: 30 }}><div className="section-heading"><h2 id="requests-title" className="heading-icon"><Clock size={18} aria-hidden="true" />Solicitudes por confirmar</h2><span className="muted">La más antigua primero</span></div>
    <ul className="wait-list">{sorted.map(a => <RequestRow key={a.id} a={a} vets={vets} />)}</ul></section>
}

function NextPatient({ waiting }: { waiting: ClinicAppointment[] }) {
  const me = useMe()
  const now = useNow()
  const action = useStageAction()
  const next = waiting.find(a => mayStart(me.data, a))
  if (!next) return null
  return <section className="panel next-patient" aria-labelledby="next-patient-title"><span className="stat-icon teal"><Armchair aria-hidden="true" /></span>
    <div><p className="eyebrow">MI SIGUIENTE PACIENTE</p><h2 id="next-patient-title">{next.pet.name} · {next.service.name}</h2><p className="muted">{next.pet.species} · {next.pet.breed} · {fullName(next.owner)} · <WaitTime a={next} now={now} /></p>
      {next.pet.notes && <p className="danger-note"><TriangleAlert size={15} aria-hidden="true" /> {next.pet.notes}</p>}{action.isError && <ErrorState error={action.error} />}</div>
    <button className="button" disabled={action.isPending} onClick={() => action.mutate({ id: next.id, action: 'start' })}><Play size={17} />{action.isPending ? 'Iniciando…' : 'Iniciar consulta'}</button></section>
}

export function ClinicHome() {
  const me = useMe()
  const user = me.data
  const isVet = can(user, 'vet')
  const frontDesk = can(user, 'admin', 'reception')
  const today = todayLima()
  const summary = useClinicSummary(true)
  const agenda = useAgenda({ date_from: today, date_to: today, mine: isVet }, true)
  const requests = useAgenda({ status: 'Pendiente' }, false, frontDesk)
  const pending = usePendingPayments(allowed(user, 'cashier'))
  if (summary.isPending || agenda.isPending) return <Loading />
  if (summary.isError || agenda.isError) return <ErrorState error={summary.error ?? agenda.error} retry={() => { void summary.refetch(); void agenda.refetch() }} />
  const t = summary.data.today
  const active = agenda.data.filter(a => a.status !== 'Cancelada')
  const confirmed = active.filter(a => a.status === 'Confirmada')
  const owed = (pending.data ?? []).reduce((sum, a) => sum + Number(a.service.price), 0)
  const stat = (Icon: typeof Clock, tone: string, label: string, value: string, to?: string) => {
    const body = <><span className={`stat-icon ${tone}`}><Icon aria-hidden="true" /></span><div><span>{label}</span><strong>{value}</strong></div>{to && <ArrowRight size={20} aria-hidden="true" />}</>
    return to ? <Link className="stat-card" to={to}>{body}</Link> : <article className="stat-card">{body}</article>
  }
  return <><PageHeader eyebrow={user?.membership?.clinic_name.toUpperCase()} title={`Hola, ${user?.profile.first_name ?? ''}`} description={isVet ? 'Tus pacientes de hoy y su historial, en un solo lugar.' : 'El día de un vistazo: quién llega, quién espera y qué falta cobrar.'} action={<Link className="button" to="/clinica/agenda"><CalendarDays size={18} />Ver agenda</Link>} />
    <div className="stats-grid four">
      {isVet ? <>{stat(CalendarCheck, 'teal', 'Tus citas confirmadas hoy', String(summary.data.my_today).padStart(2, '0'))}{stat(Armchair, 'amber', 'Tus pacientes en sala', String(confirmed.filter(a => stageOf(a) === 'En sala de espera').length).padStart(2, '0'))}{stat(Stethoscope, 'teal', 'En consulta', String(confirmed.filter(a => stageOf(a) === 'En consulta').length).padStart(2, '0'))}{stat(Check, 'teal', 'Atendidas hoy', String(t.Atendida ?? 0).padStart(2, '0'))}</>
        : <>{stat(Clock, 'amber', 'Solicitudes por confirmar', String(summary.data.pending_requests).padStart(2, '0'), '/clinica/agenda?estado=Pendiente')}{stat(Armchair, 'teal', 'En sala de espera', String(summary.data.waiting ?? 0).padStart(2, '0'))}{stat(Wallet, 'amber', `Por cobrar · ${pending.data?.length ?? 0}`, money(owed), allowed(user, 'cashier') ? '/clinica/caja' : undefined)}{stat(UserX, 'amber', 'Inasistencias de hoy', String(t['No asistió'] ?? 0).padStart(2, '0'))}</>}
    </div>
    {isVet && <NextPatient waiting={confirmed.filter(a => stageOf(a) === 'En sala de espera').sort((x, y) => (x.arrived_at ?? '').localeCompare(y.arrived_at ?? ''))} />}
    <TodayBoard items={confirmed} updatedAt={agenda.dataUpdatedAt} />
    {frontDesk && requests.isError && <ErrorState error={requests.error} retry={() => void requests.refetch()} />}
    {frontDesk && !!requests.data?.length && <RequestList items={requests.data} />}
    <div className="section-heading" style={{ padding: '8px 0 14px', border: 0 }}><h2>{isVet ? 'Tus citas de hoy' : 'Agenda de hoy'}</h2></div>
    {active.length ? <AgendaTable items={active} showDate={false} /> : <div className="panel"><EmptyState title="No hay citas para hoy" action={frontDesk && <Link className="button secondary" to="/clinica/agenda">Abrir agenda</Link>}>{isVet ? 'Cuando recepción te asigne una cita, aparecerá aquí.' : 'Las solicitudes nuevas aparecerán aquí y en la agenda.'}</EmptyState></div>}
  </>
}

export function Agenda() {
  const me = useMe()
  const [params] = useSearchParams()
  const initialStatus = params.get('estado') ?? ''
  const [filter, setFilter] = useState<AgendaFilter>({ date_from: initialStatus ? '' : todayLima(), date_to: '', status: initialStatus, mine: can(me.data, 'vet') })
  const agenda = useAgenda(filter)
  const set = (patch: Partial<AgendaFilter>) => setFilter(f => ({ ...f, ...patch }))
  return <><PageHeader eyebrow="ORGANIZA LA ATENCIÓN" title="Agenda" description="Confirma solicitudes, asigna veterinarios y da seguimiento a cada cita." />
    <div className="toolbar">
      <Field id="date_from" label="Desde"><input id="date_from" type="date" value={filter.date_from} onChange={e => set({ date_from: e.target.value })} /></Field>
      <Field id="date_to" label="Hasta"><input id="date_to" type="date" value={filter.date_to} onChange={e => set({ date_to: e.target.value })} /></Field>
      <Field id="status" label="Estado"><select id="status" value={filter.status} onChange={e => set({ status: e.target.value })}><option value="">Todos</option>{STATUSES.map(s => <option key={s} value={s}>{s === 'Pendiente' ? 'Por confirmar' : s}</option>)}</select></Field>
      {can(me.data, 'vet', 'admin') && <label className="check"><input type="checkbox" checked={!!filter.mine} onChange={e => set({ mine: e.target.checked })} />Solo mis citas</label>}
    </div>
    {agenda.isPending ? <Loading /> : agenda.isError ? <ErrorState error={agenda.error} retry={() => void agenda.refetch()} /> : agenda.data.length ? <AgendaTable items={agenda.data} /> : <div className="panel"><EmptyState title="No hay citas con estos filtros">Prueba con otro rango de fechas o estado.</EmptyState></div>}
  </>
}

export function ClinicAppointmentDetail() {
  const { id } = useParams()
  const me = useMe()
  const appointment = useClinicAppointment(id)
  const staff = useStaff()
  const client = useQueryClient()
  const stageAction = useStageAction()
  const [notice, setNotice] = useState('')
  const [confirm, setConfirm] = useState<'Cancelada' | 'No asistió' | null>(null)
  const [vetId, setVetId] = useState<string>()
  const [reprogram, setReprogram] = useState(false)
  const [newDate, setNewDate] = useState<string>()
  const [newSlot, setNewSlot] = useState('')
  const [notes, setNotes] = useState<string>()
  const a = appointment.data
  const selectedVet = vetId ?? (a?.vet ? String(a.vet.id) : '')
  const date = newDate ?? (a ? limaParts(a.starts_at).date : '')
  const slots = useStaffAvailability({ service_id: a?.service.id ?? 0, date, vet_id: selectedVet ? Number(selectedVet) : null, exclude_appointment_id: a?.id }, reprogram)
  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api<ClinicAppointment>(`/clinic/appointments/${id}`, json('PATCH', body)),
    onSuccess: async (data, body) => {
      client.setQueryData(['clinic', 'appointments', 'detail', id], data)
      await client.invalidateQueries({ queryKey: ['clinic'] })
      setConfirm(null); setReprogram(false); setNewDate(undefined); setNewSlot('')
      setNotice(body.status === 'Confirmada' ? 'Cita confirmada.' : body.status ? `La cita quedó como «${data.status}».` : body.starts_at ? 'Cita reprogramada.' : 'Cambios guardados.')
    },
    onError: async error => {
      // 409: el veterinario ya tiene otra cita que se cruza o el turno se ocupó.
      if (error instanceof ApiError && error.status === 409) { setNewSlot(''); await client.invalidateQueries({ queryKey: ['clinic', 'availability'] }) }
    },
  })
  if (appointment.isPending) return <Loading />
  if (appointment.isError || !a) return <ErrorState error={appointment.error} retry={() => void appointment.refetch()} />
  const frontDesk = can(me.data, 'admin', 'reception')
  const clinician = can(me.data, 'admin', 'vet')
  const open = a.status === 'Pendiente' || a.status === 'Confirmada'
  const stage = stageOf(a)
  const vets = staff.data?.filter(s => s.is_active && (s.role === 'vet' || s.role === 'admin')) ?? []
  const staffNotes = notes ?? a.staff_notes
  const conflict = mutation.error instanceof ApiError && mutation.error.status === 409
  const run = (body: Record<string, unknown>) => { setNotice(''); stageAction.reset(); mutation.mutate(body) }
  const runStage = (action: 'arrival' | 'start') => { setNotice(''); mutation.reset(); stageAction.mutate({ id: a.id, action }, { onSuccess: () => setNotice(action === 'arrival' ? 'Llegada registrada: el paciente está en sala de espera.' : 'Consulta iniciada.') }) }
  return <><Back to="/clinica/agenda">Agenda</Back><PageHeader title={`${a.service.name} · ${a.pet.name}`} description={`Cita #${String(a.id).padStart(4, '0')} · solicitada el ${dateTime(a.created_at)}`} action={<Badge status={stage} />} />
    {notice && <Notice>{notice}</Notice>}{mutation.isError && !confirm && <ErrorState title={conflict ? 'Hay un cruce de horario' : undefined} error={mutation.error} />}{stageAction.isError && <ErrorState error={stageAction.error} />}
    <div className="booking-layout"><section className="panel appointment-detail">
      <div className="appointment-detail-title"><span className="pet-avatar"><PetIcon species={a.pet.species} size={38} /></span><div><p className="eyebrow">PACIENTE</p><h2>{a.pet.name}</h2><p className="muted">{a.pet.species} · {a.pet.breed} · {a.pet.sex} · {a.pet.weight} kg</p></div></div>
      <div className="appointment-location"><p><CalendarDays size={21} /><strong>{dateTime(a.starts_at)} · Lima</strong></p><p><Clock3 size={21} /><span>{a.service.duration_minutes} minutos{a.arrived_at && <small>Llegó a las {timeOnly(a.arrived_at)}{a.started_at && ` · consulta desde las ${timeOnly(a.started_at)}`}</small>}</span></p><p><Phone size={21} /><span>{fullName(a.owner)}<small>{a.owner.phone}</small></span></p></div>
      <div className="notes-section"><h3>Motivo indicado por el propietario</h3><p>{a.reason || 'Sin comentario.'}</p></div>
      {a.pet.notes && <div className="notes-section"><h3>Observaciones de la mascota</h3><p>{a.pet.notes}</p></div>}
      {a.payment && <div className="notes-section"><h3>Cobro</h3><p>{money(a.payment.amount)} · {a.payment.method} · {dateTime(a.payment.paid_at)}</p></div>}
      <div className="appointment-detail-footer"><p>Revisa antecedentes antes de atender.</p><div className="inline-actions"><Link className="button secondary" to={`/clinica/pacientes/${a.pet.id}`}>Ver historial</Link>
        {stage === 'Confirmada' && isToday(a) && allowed(me.data, 'arrival') && <button className="button secondary" disabled={stageAction.isPending} onClick={() => runStage('arrival')}><DoorOpen size={17} />Registrar llegada</button>}
        {stage === 'En sala de espera' && mayStart(me.data, a) && <button className="button secondary" disabled={stageAction.isPending} onClick={() => runStage('start')}><Play size={17} />Iniciar consulta</button>}
        {clinician && open && <Link className="button" to={`/clinica/pacientes/${a.pet.id}?cita=${a.id}`}><ClipboardPlus size={17} />Registrar atención</Link>}</div></div>
    </section>
    <aside className="stack">
      {frontDesk && open && <section className="panel form-panel"><h2>Gestionar cita</h2>
        <div className="form-grid" style={{ marginTop: 16 }}>
          <Field id="vet" label="Veterinario" full><select id="vet" value={selectedVet} onChange={e => { setVetId(e.target.value); setNewSlot('') }}><option value="">Por asignar</option>{vets.map(v => <option key={v.user_id} value={v.user_id}>{fullName(v.profile)}</option>)}</select></Field>
          {a.status === 'Pendiente' ? <button className="button full" disabled={mutation.isPending} onClick={() => run({ status: 'Confirmada', vet_id: selectedVet ? Number(selectedVet) : null })}><Check size={17} />Confirmar cita</button>
            : <button className="button secondary full" disabled={mutation.isPending || selectedVet === (a.vet ? String(a.vet.id) : '')} onClick={() => run({ vet_id: selectedVet ? Number(selectedVet) : null })}><Save size={17} />Guardar veterinario</button>}
          <h3 className="sub full">Reprogramar</h3>
          {!reprogram ? <button className="button secondary full" disabled={!!a.arrived_at} onClick={() => setReprogram(true)}><CalendarClock size={17} />Elegir otro horario</button> : <>
            <Field id="new_date" label="Nuevo día" full><input id="new_date" type="date" min={todayLima()} value={date} onChange={e => { setNewDate(e.target.value); setNewSlot('') }} /></Field>
            <div className="full"><SlotPicker id="new_slot" label={selectedVet ? 'Turnos libres del veterinario elegido' : 'Turnos libres de la veterinaria'} query={slots} value={newSlot} onChange={setNewSlot} /></div>
            <div className="inline-actions full"><button className="button secondary" onClick={() => { setReprogram(false); setNewSlot('') }}>Cancelar</button><button className="button" disabled={mutation.isPending || !newSlot} onClick={() => run({ starts_at: newSlot })}><CalendarClock size={17} />Guardar nuevo horario</button></div></>}
          <div className="inline-actions full" style={{ justifyContent: 'space-between' }}>
            <button className="button secondary danger-text" disabled={mutation.isPending} onClick={() => { mutation.reset(); setConfirm('Cancelada') }}><X size={17} />Cancelar cita</button>
            {a.status === 'Confirmada' && !a.arrived_at && new Date(a.starts_at).getTime() < Date.now() && <button className="button secondary" disabled={mutation.isPending} onClick={() => { mutation.reset(); setConfirm('No asistió') }}><UserX size={17} />No asistió</button>}
          </div>
        </div></section>}
      {frontDesk && <section className="panel form-panel"><h2>Notas internas</h2><p className="muted">Solo las ve el equipo de la veterinaria.</p>
        <div className="form-grid" style={{ marginTop: 12 }}><Field id="staff_notes" label="Notas" full><textarea id="staff_notes" rows={4} maxLength={2000} value={staffNotes} onChange={e => setNotes(e.target.value)} /></Field>
          <div className="form-actions full"><button className="button secondary" disabled={mutation.isPending || notes === undefined || notes === a.staff_notes} onClick={() => run({ staff_notes: staffNotes })}><Save size={17} />Guardar notas</button></div></div></section>}
      {!frontDesk && a.staff_notes && <section className="panel form-panel"><h2>Notas internas</h2><p className="muted" style={{ whiteSpace: 'pre-wrap' }}>{a.staff_notes}</p></section>}
    </aside></div>
    <ConfirmDialog open={!!confirm} title={confirm === 'Cancelada' ? `¿Cancelar la cita de ${a.pet.name}?` : `¿Marcar que ${a.pet.name} no asistió?`} confirmLabel={confirm === 'Cancelada' ? 'Cancelar turno' : 'Marcar inasistencia'} cancelLabel="Mantener" pending={mutation.isPending} onCancel={() => setConfirm(null)} onConfirm={() => run({ status: confirm })} error={mutation.error}><p>{confirm === 'Cancelada' ? 'El horario quedará libre. El propietario verá la cita como cancelada; te recomendamos avisarle por teléfono.' : 'La cita quedará registrada como inasistencia y cuenta en el indicador del mes.'}</p>
      <dl className="dialog-summary"><dt>Paciente</dt><dd>{a.pet.name}</dd><dt>Propietario</dt><dd>{fullName(a.owner)} · {a.owner.phone}</dd><dt>Turno</dt><dd>{relativeDateTime(a.starts_at)} · {a.service.name}</dd></dl></ConfirmDialog>
  </>
}
