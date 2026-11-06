import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, BadgeCheck, CalendarDays, Clock, Clock3, Info, MapPin, Plus, Send, Wallet, X, Zap } from 'lucide-react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Back, Badge, ConfirmDialog, EmptyState, ErrorState, Field, LiveNote, Loading, PageHeader, PetIcon, SlotPicker, StageTimeline } from '../components/ui'
import { addDays, daysLabel, fullName, hhmm, isoWeekday, limaParts, money, ownerStageText, relativeDate, relativeDateTime, stageOf, timeOnly } from '../lib/format'
import { api, ApiError, json } from '../lib/api'
import { isLiveToday, useAppointment, useAppointments, useAvailability, useClinics, usePets, useServices } from '../lib/queries'
import { appointmentSchema, todayLima, type AppointmentValues } from '../lib/schemas'
import type { Appointment, Availability, Service } from '../lib/types'

const isOpen = (a: Appointment) => a.status === 'Pendiente' || a.status === 'Confirmada'
const paymentText = (a: Appointment) => a.payment ? `Pagado ${money(a.payment.amount)} · ${a.payment.method}` : a.status === 'Atendida' ? 'Pago en la veterinaria' : null

export function AppointmentList() {
  const appointments = useAppointments()
  const [segment, setSegment] = useState<'next' | 'past'>('next')
  const list = appointments.data?.filter(a => segment === 'next' ? isOpen(a) : !isOpen(a))
    .sort((x, y) => segment === 'next' ? x.starts_at.localeCompare(y.starts_at) : y.starts_at.localeCompare(x.starts_at))
  return <><PageHeader eyebrow="UN CUIDADO A LA VEZ" title="Mis citas" description="Consulta el estado de tus turnos y pide uno nuevo cuando lo necesites." action={<Link to="/app/citas/nueva" className="button"><Plus size={18} />Pedir turno</Link>} />
    <div className="filter-tabs" role="group" aria-label="Mostrar citas">{([['next', 'Próximas'], ['past', 'Anteriores']] as const).map(([value, label]) => <button key={value} aria-pressed={segment === value} className={segment === value ? 'selected' : ''} onClick={() => setSegment(value)}>{label}</button>)}</div>
    {appointments.isPending ? <Loading /> : appointments.isError ? <ErrorState error={appointments.error} retry={() => void appointments.refetch()} /> : !list?.length ? <div className="panel"><EmptyState title={segment === 'next' ? 'No tienes turnos próximos' : 'Aún no hay citas anteriores'} action={segment === 'next' && <Link to="/app/citas/nueva" className="button secondary">Pedir turno</Link>}>{segment === 'next' ? 'Elige a tu mascota, la veterinaria y un horario libre en menos de un minuto.' : 'Aquí verás las citas atendidas, canceladas o a las que no asististe.'}</EmptyState></div>
      : <div className="appointment-list">{list.map(a => <article className="panel appointment-card" key={a.id}><div className="appointment-card-main"><span className="pet-avatar"><PetIcon species={a.pet.species} /></span><div><p className="eyebrow">{a.pet.name}</p><h2>{a.service.name}</h2><p className="muted">{a.clinic.name}{a.vet ? ` · ${fullName(a.vet.profile)}` : ''}</p></div><Badge status={stageOf(a)} /></div>
        <div className="appointment-card-bottom"><span><CalendarDays size={17} aria-hidden="true" />{relativeDateTime(a.starts_at)}</span>{paymentText(a) && <span>{a.payment ? <BadgeCheck size={17} aria-hidden="true" /> : <Wallet size={17} aria-hidden="true" />}{paymentText(a)}</span>}<Link className="text-link" to={`/app/citas/${a.id}`}>Ver detalle <ArrowRight size={17} /></Link></div></article>)}</div>}
  </>
}

const SERVICE_HINT: Record<string, RegExp> = { Vacuna: /vacun/i, 'Desparasitación': /desparasit/i, Tratamiento: /control|consulta/i, Control: /control|consulta/i }
const DAYS_AHEAD = 14
const STEP_TITLES = ['¿Para quién es el turno?', 'Veterinaria y servicio', 'Día y hora', 'Revisa y solicita']

export function AppointmentForm() {
  const [params] = useSearchParams()
  const numberParam = (name: string) => { const n = Number(params.get(name)); return Number.isInteger(n) && n > 0 ? n : 0 }
  const pets = usePets()
  const clinics = useClinics()
  const history = useAppointments()
  const navigate = useNavigate()
  const client = useQueryClient()
  const [step, setStep] = useState(1)
  const [taken, setTaken] = useState(false)
  const [searching, setSearching] = useState('')
  const heading = useRef<HTMLHeadingElement>(null)
  const moved = useRef(false)
  const { register, handleSubmit, watch, setValue, trigger, formState: { errors } } = useForm<AppointmentValues>({
    resolver: zodResolver(appointmentSchema), defaultValues: { pet_id: numberParam('pet'), clinic_id: numberParam('clinic'), service_id: numberParam('service'), date: '', starts_at: '', reason: '' },
  })
  const petId = Number(watch('pet_id'))
  const clinicId = Number(watch('clinic_id'))
  const serviceId = Number(watch('service_id'))
  const date = watch('date')
  const startsAt = watch('starts_at')
  const services = useServices(clinicId)
  const service = services.data?.find(s => s.id === serviceId)
  const clinic = clinics.data?.find(c => c.id === clinicId)
  const pet = pets.data?.find(p => p.id === petId)
  const availability = useAvailability(clinicId, serviceId, date)
  const today = todayLima()
  const days = Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(today, i))
  const openOn = (d: string) => !clinic?.open_days?.length || clinic.open_days.includes(isoWeekday(d))

  // Preselecciones: única mascota, veterinaria del recordatorio (por nombre) o la última usada, servicio sugerido.
  useEffect(() => { if (!petId && pets.data?.length === 1) setValue('pet_id', pets.data[0].id) }, [pets.data, petId, setValue])
  useEffect(() => {
    if (clinicId || !clinics.data?.length) return
    const byName = params.get('clinic_name') && clinics.data.find(c => c.name === params.get('clinic_name'))
    const last = history.data?.length ? [...history.data].sort((x, y) => y.created_at.localeCompare(x.created_at))[0].clinic.id : 0
    const id = byName ? byName.id : clinics.data.some(c => c.id === last) ? last : 0
    if (id) setValue('clinic_id', id)
  }, [clinics.data, history.data, clinicId, params, setValue])
  useEffect(() => {
    const hint = SERVICE_HINT[params.get('kind') ?? '']
    if (serviceId || !hint || !services.data) return
    const match = services.data.find(s => hint.test(s.name))
    if (match) setValue('service_id', match.id)
  }, [services.data, serviceId, params, setValue])
  useEffect(() => { if (moved.current) heading.current?.focus(); moved.current = true }, [step])

  const clearSlot = () => setValue('starts_at', '')
  const pickService = (s: Service) => { setValue('service_id', s.id, { shouldValidate: true }); clearSlot() }
  const go = async (to: number) => {
    const fields = ([['pet_id'], ['clinic_id', 'service_id'], ['date', 'starts_at']] as const)[step - 1]
    if (to > step && fields && !(await trigger([...fields]))) return
    setTaken(false); setStep(to)
  }
  async function firstFree() {
    setSearching('Buscando el primer turno libre…')
    const start = date && date >= today ? date : today
    for (let i = 0; i < DAYS_AHEAD; i++) {
      const d = addDays(start, i)
      if (d > days[days.length - 1]) break
      if (!openOn(d)) continue
      try {
        const data = await client.fetchQuery({ queryKey: ['availability', clinicId, serviceId, d], queryFn: () => api<Availability>(`/clinics/${clinicId}/availability?service_id=${serviceId}&date=${d}`) })
        const slot = data.slots.find(s => s.available)
        if (slot) { setValue('date', d, { shouldValidate: true }); setValue('starts_at', slot.starts_at, { shouldValidate: true }); setSearching(''); return }
      } catch (e) { setSearching(''); throw e }
    }
    setSearching('No encontramos turnos libres en los próximos 14 días. Prueba con otro servicio o veterinaria.')
  }
  const mutation = useMutation({
    mutationFn: ({ date: _date, ...values }: AppointmentValues) => { void _date; return api<Appointment>('/appointments', json('POST', values)) },
    onSuccess: async data => { await client.invalidateQueries({ queryKey: ['appointments'] }); navigate(`/app/citas/${data.id}`, { state: { created: true }, replace: true }) },
    onError: async error => {
      // 409: el turno se ocupó mientras elegías; 422: quedó fuera del horario. Se vuelve al paso 3 sin perder lo demás.
      if (error instanceof ApiError && (error.status === 409 || error.status === 422)) {
        clearSlot(); setTaken(true); setStep(3); mutation.reset()
        await client.invalidateQueries({ queryKey: ['availability'] })
      }
    },
  })
  if (pets.isPending || clinics.isPending) return <Loading />
  if (pets.isError || clinics.isError) return <ErrorState error={pets.error ?? clinics.error} retry={() => { void pets.refetch(); void clinics.refetch() }} />
  if (!pets.data.length) return <><Back to="/app/citas">Mis citas</Back><div className="panel"><EmptyState title="Agrega a tu mascota para pedir su primer turno" action={<Link className="button" to="/app/mascotas/nueva">Agregar mascota</Link>}>Necesitamos conocer a tu compañero para asociar el turno a tu cuenta.</EmptyState></div></>
  if (!clinics.data.length) return <EmptyState title="No hay veterinarias disponibles">Vuelve a consultar el catálogo más adelante.</EmptyState>
  const back = step > 1 && <button type="button" className="button secondary" onClick={() => void go(step - 1)}><ArrowLeft size={17} />Atrás</button>
  return <><Back to="/app/citas">Mis citas</Back><PageHeader title="Pedir turno" description="Cuatro pasos y listo. Verás el precio y los horarios libres antes de solicitar." />
    <div className="booking-layout"><section className="panel form-panel">
      <div className="step-progress"><span>Paso {step} de 4</span><span className="bar" aria-hidden="true"><span style={{ width: `${step * 25}%` }} /></span></div>
      <form noValidate className="form-grid" onSubmit={handleSubmit(data => mutation.mutate(data))}>
        <h2 className="full" ref={heading} tabIndex={-1}>{STEP_TITLES[step - 1]}</h2>
        {step === 1 && <fieldset className="full slot-picker" aria-describedby={errors.pet_id ? 'pet_id-error' : undefined}><legend className="sr-only">Mascota</legend>
          <div className="choice-grid">{pets.data.map(p => <button type="button" key={p.id} className="choice" aria-pressed={petId === p.id} onClick={() => setValue('pet_id', p.id, { shouldValidate: true })}><strong>{p.name}</strong><small>{p.species} · {p.breed}</small></button>)}</div>
          {errors.pet_id && <span className="field-error" role="alert" id="pet_id-error">{errors.pet_id.message}</span>}</fieldset>}
        {step === 2 && <>
          <Field id="clinic_id" label="Veterinaria" error={errors.clinic_id?.message} full><select id="clinic_id" aria-invalid={!!errors.clinic_id} aria-describedby={errors.clinic_id ? 'clinic_id-error' : undefined} {...register('clinic_id', { onChange: () => { setValue('service_id', 0); clearSlot() } })}><option value="0">Selecciona una veterinaria</option>{clinics.data.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          {clinicId > 0 && <fieldset className="full slot-picker" aria-describedby={errors.service_id ? 'service_id-error' : undefined}><legend>Servicio</legend>
            {services.isPending ? <Loading label="Cargando servicios…" /> : services.isError ? <ErrorState error={services.error} retry={() => void services.refetch()} /> : !services.data.length ? <p className="muted">Esta veterinaria todavía no tiene servicios disponibles.</p>
              : <div className="choice-grid">{services.data.map(s => <button type="button" key={s.id} className="choice" aria-pressed={serviceId === s.id} onClick={() => pickService(s)}><strong>{s.name}</strong><small>{s.duration_minutes} min · <span className="money">{money(s.price)}</span></small></button>)}</div>}
            {errors.service_id && <span className="field-error" role="alert" id="service_id-error">{errors.service_id.message}</span>}</fieldset>}
        </>}
        {step === 3 && <>
          {taken && <div className="full"><ErrorState title="Ese horario se acaba de ocupar" error={new Error('Recargamos los turnos libres. Elige otro; lo demás se mantiene.')} /></div>}
          {clinic?.opens_at && <p className="muted full">{clinic.name} atiende de {daysLabel(clinic.open_days)}, de {hhmm(clinic.opens_at, '09:00')} a {hhmm(clinic.closes_at, '18:00')} (hora de Lima).</p>}
          <fieldset className="full slot-picker"><legend>Día</legend><div className="day-strip">{days.map(d => { const open = openOn(d); return <button type="button" key={d} className="day-chip" disabled={!open} aria-pressed={date === d} aria-label={`${relativeDate(d)}${open ? '' : ', cerrado'}`} onClick={() => { setValue('date', d, { shouldValidate: true }); clearSlot() }}>{relativeDate(d)}{!open && <small>Cerrado</small>}</button> })}</div>
            {errors.date && !date && <span className="field-error" role="alert">Elige un día.</span>}</fieldset>
          <div className="full inline-actions"><button type="button" className="button lime small" disabled={!!searching && searching.startsWith('Buscando')} onClick={() => void firstFree().catch(e => setSearching((e as Error).message))}><Zap size={16} />Primer turno libre</button>{searching && <span className="muted" role="status">{searching}</span>}</div>
          <div className="full">{date ? <SlotPicker id="starts_at" label="Horario disponible" query={availability} value={startsAt} onChange={v => setValue('starts_at', v, { shouldValidate: true })} error={errors.starts_at?.message} />
            : errors.starts_at ? <span className="field-error" role="alert">{errors.starts_at.message}</span> : <p className="muted">Elige un día para ver los turnos o usa «Primer turno libre».</p>}</div>
        </>}
        {step === 4 && <>
          <dl className="detail-grid full">{[['Mascota', pet ? `${pet.name} · ${pet.species}` : '—'], ['Veterinaria', clinic?.name ?? '—'], ['Servicio', service?.name ?? '—'], ['Duración', service ? `${service.duration_minutes} min` : '—'], ['Precio referencial', service ? money(service.price) : '—'], ['Día y hora', startsAt ? `${relativeDate(limaParts(startsAt).date)} · ${timeOnly(startsAt)}` : '—']].map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
          <Field id="reason" label="Motivo (opcional)" hint="¿Qué le pasa? Ayuda a preparar la consulta." error={errors.reason?.message} full><textarea id="reason" rows={4} maxLength={2000} aria-describedby="reason-hint" {...register('reason')} /></Field>
          {mutation.isError && <div className="full"><ErrorState error={mutation.error} /></div>}
        </>}
        <div className="form-actions full">{back || <Link to="/app/citas" className="button secondary">Volver</Link>}
          {/* Distinct keys: reusing one <button> lets the "Continuar" click submit the form once it turns into type=submit. */}
          {step < 4 ? <button key="next" type="button" className="button" onClick={() => void go(step + 1)}>Continuar<ArrowRight size={17} /></button>
            : <button key="submit" type="submit" className="button" disabled={mutation.isPending}><Send size={17} />{mutation.isPending ? 'Enviando…' : 'Solicitar turno'}</button>}</div>
      </form></section>
      <aside className="booking-aside"><div className="panel booking-summary"><span className="stat-icon teal"><CalendarDays /></span><h2>Tu turno</h2>
        <p className="muted">{pet ? `Para ${pet.name}` : 'Elige a tu mascota.'}{clinic ? ` en ${clinic.name}` : ''}</p>
        {service && <><hr /><h3>{service.name}</h3><p>{service.description}</p><div className="service-meta"><span><Clock3 size={16} />{service.duration_minutes} min</span><strong className="money">{money(service.price)}</strong></div></>}
        {startsAt && <p style={{ marginTop: 14 }}><strong>{relativeDate(limaParts(startsAt).date)} · {timeOnly(startsAt)}</strong></p>}
        <div className="booking-info"><Info size={20} /><p>Tu solicitud queda «Por confirmar» hasta que la veterinaria la confirme. Horarios en hora de Lima.</p></div></div>
        <p className="catalog-disclaimer">Precios referenciales. El pago se realiza en la veterinaria.</p></aside></div></>
}

export function AppointmentDetail() {
  const { id } = useParams()
  const appointment = useAppointment(id)
  const location = useLocation()
  const client = useQueryClient()
  const [confirm, setConfirm] = useState(false)
  const [cancelled, setCancelled] = useState(false)
  const mutation = useMutation({ mutationFn: () => api<Appointment>(`/appointments/${id}/cancel`, json('PATCH')), onSuccess: async () => { await client.invalidateQueries({ queryKey: ['appointments'] }); setConfirm(false); setCancelled(true) } })
  if (appointment.isPending) return <Loading />
  if (appointment.isError) return <ErrorState error={appointment.error} retry={() => void appointment.refetch()} />
  const a = appointment.data
  const stage = stageOf(a)
  const cancellable = isOpen(a) && !a.arrived_at
  const when = `${relativeDate(limaParts(a.starts_at).date)} a las ${timeOnly(a.starts_at)}`
  return <><Back to="/app/citas">Mis citas</Back>
    {location.state?.created && !cancelled && <section className="panel booking-success" role="status" style={{ marginBottom: 22 }}><span className="stat-icon amber"><Clock /></span><h2>Turno solicitado</h2><p style={{ margin: '10px 0' }}><Badge status="Por confirmar" /></p><p className="muted">La veterinaria confirmará tu turno. Revisa su estado aquí.</p></section>}
    {cancelled && <div className="notice" role="status">Cancelaste el turno. El horario quedó libre para otra mascota.</div>}
    <PageHeader title="Detalle de la cita" description={`Solicitud #${String(a.id).padStart(4, '0')}`} action={<Badge status={stage} />} />
    <section className="panel appointment-detail"><div className="appointment-detail-title"><span className="pet-avatar"><PetIcon species={a.pet.species} size={38} /></span><div><p className="eyebrow">PARA {a.pet.name}</p><h2>{a.service.name}</h2></div></div>
      <StageTimeline appointment={a} /><p className="stage-message" aria-live="polite">{ownerStageText(a)}</p>{isLiveToday(a) && <LiveNote updatedAt={appointment.dataUpdatedAt} />}
      <div className="appointment-location"><p><CalendarDays size={21} /><strong>{relativeDateTime(a.starts_at)} · Lima</strong></p><p><MapPin size={21} /><span>{a.clinic.name}<small>{a.clinic.address}</small></span></p><p><Clock3 size={21} /><span>Duración estimada: {a.service.duration_minutes} minutos</span></p></div>
      <dl className="detail-grid"><div><dt>Mascota</dt><dd>{a.pet.name} · {a.pet.species}</dd></div><div><dt>Precio referencial</dt><dd className="money">{money(a.service.price)}</dd></div><div><dt>Teléfono de la veterinaria</dt><dd>{a.clinic.phone}</dd></div><div><dt>Veterinario asignado</dt><dd>{a.vet ? fullName(a.vet.profile) : 'Por asignar'}</dd></div>{a.arrived_at && <div><dt>Llegada</dt><dd>{timeOnly(a.arrived_at)}</dd></div>}{a.started_at && <div><dt>Inicio de la consulta</dt><dd>{timeOnly(a.started_at)}</dd></div>}<div><dt>Pago</dt><dd>{paymentText(a) ?? 'Se paga en la veterinaria'}</dd></div></dl>
      <div className="notes-section"><h3>Motivo o comentario</h3><p>{a.reason || 'No añadiste un comentario para esta visita.'}</p></div>
      {a.has_record && <div className="appointment-detail-footer"><p>Esta atención ya está en el historial clínico de {a.pet.name}.</p><Link className="button secondary" to={`/app/mascotas/${a.pet.id}`}>Ver historial</Link></div>}
      {cancellable && <div className="appointment-detail-footer"><p>¿No puedes ir? Cancela con anticipación para liberar el horario.</p><button className="button secondary danger-text" onClick={() => { mutation.reset(); setConfirm(true) }}><X size={17} />Cancelar turno</button></div>}</section>
    <ConfirmDialog open={confirm} title={`¿Cancelar el turno de ${a.pet.name} del ${when}?`} confirmLabel="Cancelar turno" cancelLabel="Mantener" pending={mutation.isPending} onCancel={() => setConfirm(false)} onConfirm={() => mutation.mutate()} error={mutation.error}>
      <p>El horario quedará libre para otra mascota.</p>
      <dl className="dialog-summary"><dt>Servicio</dt><dd>{a.service.name}</dd><dt>Veterinaria</dt><dd>{a.clinic.name}</dd><dt>Turno</dt><dd>{relativeDateTime(a.starts_at)}</dd></dl>
    </ConfirmDialog></>
}
