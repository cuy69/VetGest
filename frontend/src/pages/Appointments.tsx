import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, CalendarDays, Clock3, Info, MapPin, Plus, Send, X } from 'lucide-react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Back, Badge, ConfirmDialog, EmptyState, ErrorState, Field, Loading, Notice, PageHeader, PetIcon } from '../components/ui'
import { dateTime, money } from '../lib/format'
import { api, json } from '../lib/api'
import { useAppointment, useAppointments, useClinics, usePets, useServices } from '../lib/queries'
import { appointmentSchema, todayLima, type AppointmentValues } from '../lib/schemas'
import type { Appointment } from '../lib/types'

export function AppointmentList() {
  const appointments = useAppointments()
  const [filter, setFilter] = useState('Todas')
  const filtered = appointments.data?.filter(a => filter === 'Todas' || a.status === filter)
  return <><PageHeader eyebrow="UN CUIDADO A LA VEZ" title="Mis citas" description="Consulta tus solicitudes y organiza sus próximas visitas." action={<Link to="/app/citas/nueva" className="button"><Plus size={18} />Solicitar cita</Link>} /><div className="filter-tabs" role="group" aria-label="Filtrar citas por estado">{['Todas', 'Pendiente', 'Cancelada'].map(f => <button key={f} aria-pressed={filter === f} className={filter === f ? 'selected' : ''} onClick={() => setFilter(f)}>{f === 'Pendiente' ? 'Pendientes' : f === 'Cancelada' ? 'Canceladas' : f}</button>)}</div>
    {appointments.isPending ? <Loading /> : appointments.isError ? <ErrorState error={appointments.error} retry={() => void appointments.refetch()} /> : !filtered?.length ? <div className="panel"><EmptyState title={filter === 'Todas' ? 'Todavía no has solicitado una cita' : 'No tienes citas con este estado'} action={<Link to="/app/citas/nueva" className="button secondary">Solicitar cita</Link>}>Elige una mascota, una veterinaria y el servicio que necesita.</EmptyState></div> : <div className="appointment-list">{filtered.map(a => <article className="panel appointment-card" key={a.id}><div className="appointment-card-main"><span className="pet-avatar"><PetIcon species={a.pet.species} /></span><div><p className="eyebrow">{a.pet.name}</p><h2>{a.service.name}</h2><p className="muted">{a.clinic.name}</p></div><Badge status={a.status} /></div><div className="appointment-card-bottom"><span><CalendarDays size={17} />{dateTime(a.starts_at)} · Lima</span><Link className="text-link" to={`/app/citas/${a.id}`}>Ver detalle <ArrowRight size={17} /></Link></div></article>)}</div>}
  </>
}

export function AppointmentForm() {
  const [params] = useSearchParams()
  const numberParam = (name: string) => { const n = Number(params.get(name)); return Number.isInteger(n) && n > 0 ? n : 0 }
  const pets = usePets()
  const clinics = useClinics()
  const navigate = useNavigate()
  const client = useQueryClient()
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<AppointmentValues>({
    resolver: zodResolver(appointmentSchema), defaultValues: { pet_id: numberParam('pet'), clinic_id: numberParam('clinic'), service_id: numberParam('service'), date: '', time: '', reason: '' },
  })
  const clinicId = Number(watch('clinic_id'))
  const serviceId = Number(watch('service_id'))
  const services = useServices(clinicId)
  const service = services.data?.find(s => s.id === serviceId)
  const mutation = useMutation({ mutationFn: (values: AppointmentValues) => {
    const { date, time, ...rest } = values
    return api<Appointment>('/appointments', json('POST', { ...rest, starts_at: `${date}T${time}:00-05:00` }))
  }, onSuccess: async data => { await client.invalidateQueries({ queryKey: ['appointments'] }); navigate(`/app/citas/${data.id}`, { state: { created: true }, replace: true }) } })
  if (pets.isPending || clinics.isPending) return <Loading />
  if (pets.isError || clinics.isError) return <ErrorState error={pets.error ?? clinics.error} retry={() => { void pets.refetch(); void clinics.refetch() }} />
  return <><Back to="/app/citas">Mis citas</Back><PageHeader title="Su próxima visita empieza aquí" description="Elige cómo y cuándo te gustaría que atendieran a tu mascota." />{!pets.data.length ? <div className="panel"><EmptyState title="Primero, registra a tu mascota" action={<Link className="button" to="/app/mascotas/nueva">Registrar mascota</Link>}>Necesitamos conocer a tu compañero para asociar su cita a tu cuenta.</EmptyState></div> : !clinics.data.length ? <EmptyState title="No hay veterinarias disponibles">Vuelve a consultar el catálogo más adelante.</EmptyState> : <div className="booking-layout"><section className="panel form-panel"><form noValidate className="form-grid" onSubmit={handleSubmit(data => mutation.mutate(data))}>
    <h2 className="full step-heading"><span>1</span>¿Para quién es la cita?</h2><Field id="pet_id" label="Mascota" error={errors.pet_id?.message} full><select id="pet_id" aria-invalid={!!errors.pet_id} aria-describedby={errors.pet_id ? 'pet_id-error' : undefined} {...register('pet_id')}><option value="0">Selecciona a tu mascota</option>{pets.data.map(p => <option key={p.id} value={p.id}>{p.name} · {p.species}</option>)}</select></Field>
    <h2 className="full step-heading"><span>2</span>Elige su atención</h2><Field id="clinic_id" label="Veterinaria" error={errors.clinic_id?.message} full><select id="clinic_id" aria-invalid={!!errors.clinic_id} aria-describedby={errors.clinic_id ? 'clinic_id-error' : undefined} {...register('clinic_id', { onChange: () => setValue('service_id', 0) })}><option value="0">Selecciona una veterinaria</option>{clinics.data.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
    <Field id="service_id" label="Servicio" error={errors.service_id?.message} full><select id="service_id" disabled={!clinicId || services.isPending || services.isError} aria-invalid={!!errors.service_id} aria-describedby={errors.service_id ? 'service_id-error' : undefined} {...register('service_id')}><option value="0">{!clinicId ? 'Primero elige una veterinaria' : services.isPending ? 'Cargando servicios…' : 'Selecciona un servicio'}</option>{services.data?.map(s => <option key={s.id} value={s.id}>{s.name} · {money(s.price)}</option>)}</select></Field>
    {clinicId > 0 && services.isError && <div className="full"><ErrorState error={services.error} retry={() => void services.refetch()} /></div>}{clinicId > 0 && services.isSuccess && !services.data.length && <p className="muted full">Esta veterinaria todavía no tiene servicios disponibles.</p>}
    <h2 className="full step-heading"><span>3</span>¿Cuándo te gustaría visitarnos?</h2><Field id="date" label="Fecha" error={errors.date?.message}><input id="date" type="date" min={todayLima()} aria-invalid={!!errors.date} aria-describedby={errors.date ? 'date-error' : undefined} {...register('date')} /></Field><Field id="time" label="Hora (Lima, UTC−5)" error={errors.time?.message}><input id="time" type="time" aria-invalid={!!errors.time} aria-describedby={errors.time ? 'time-error' : undefined} {...register('time')} /></Field>
    <Field id="reason" label="Motivo o comentario (opcional)" error={errors.reason?.message} full><textarea id="reason" rows={4} placeholder="Cuéntanos el motivo de la visita o tus dudas…" maxLength={2000} aria-invalid={!!errors.reason} aria-describedby={errors.reason ? 'reason-error' : undefined} {...register('reason')} /></Field>
    {mutation.isError && <div className="full"><ErrorState error={mutation.error} /></div>}<div className="form-actions full"><Link to="/app/citas" className="button secondary">Volver</Link><button className="button" disabled={mutation.isPending || services.isFetching || !service}><Send size={17} />{mutation.isPending ? 'Enviando solicitud…' : 'Solicitar cita'}</button></div>
  </form></section><aside className="booking-aside"><div className="panel booking-summary"><span className="stat-icon teal"><CalendarDays /></span><h2>Un paso para su bienestar</h2><p className="muted">Tu solicitud se guardará como pendiente.</p>{service && <><hr /><h3>{service.name}</h3><p>{service.description}</p><div className="service-meta"><span><Clock3 size={16} />{service.duration_minutes} min</span><strong>{money(service.price)}</strong></div></>}<div className="booking-info"><Info size={20} /><p>Esta solicitud no confirma disponibilidad ni reserva un horario. Todos los horarios se expresan en hora de Lima.</p></div></div><p className="catalog-disclaimer">Veterinarias y precios de demostración. No se realizan cobros.</p></aside></div>}</>
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
  return <><Back to="/app/citas">Mis citas</Back><PageHeader title="Detalle de la cita" description={`Solicitud #${String(a.id).padStart(4, '0')}`} action={<Badge status={a.status} />} />{location.state?.created && !cancelled && <Notice>Tu solicitud se registró correctamente y está pendiente. No es una reserva confirmada.</Notice>}{cancelled && <Notice>Tu cita se canceló correctamente.</Notice>}<section className="panel appointment-detail"><div className="appointment-detail-title"><span className="pet-avatar"><PetIcon species={a.pet.species} size={38} /></span><div><p className="eyebrow">PARA {a.pet.name}</p><h2>{a.service.name}</h2></div></div><div className="appointment-location"><p><CalendarDays size={21} /><strong>{dateTime(a.starts_at)} · Lima</strong></p><p><MapPin size={21} /><span>{a.clinic.name}<small>{a.clinic.address}</small></span></p><p><Clock3 size={21} /><span>Duración estimada: {a.service.duration_minutes} minutos</span></p></div><dl className="detail-grid"><div><dt>Mascota</dt><dd>{a.pet.name} · {a.pet.species}</dd></div><div><dt>Precio referencial</dt><dd>{money(a.service.price)}</dd></div><div><dt>Teléfono de la veterinaria</dt><dd>{a.clinic.phone}</dd></div><div><dt>Estado de solicitud</dt><dd>{a.status}</dd></div></dl><div className="notes-section"><h3>Motivo o comentario</h3><p>{a.reason || 'No añadiste un comentario para esta visita.'}</p></div>{a.status === 'Pendiente' && <div className="appointment-detail-footer"><p>La solicitud está pendiente y no confirma disponibilidad.</p><button className="button secondary danger-text" onClick={() => { mutation.reset(); setConfirm(true) }}><X size={17} />Cancelar cita</button></div>}</section><ConfirmDialog open={confirm} title={`¿Cancelar la cita de ${a.pet.name}?`} confirmLabel="Sí, cancelar cita" pending={mutation.isPending} onCancel={() => setConfirm(false)} onConfirm={() => mutation.mutate()} error={mutation.error}><p>La solicitud cambiará a cancelada. Si necesitas otra fecha, podrás solicitar una nueva cita.</p></ConfirmDialog></>
}
