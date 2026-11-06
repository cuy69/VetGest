import type { IconName } from '@/components/Icon'
import { fullName, money, relativeDay, timeOnly } from './format'
import type { Appointment, AppointmentStage } from './types'

const fromStatus: Record<Appointment['status'], AppointmentStage> = {
  Pendiente: 'Por confirmar', Confirmada: 'Confirmada', Atendida: 'Atendida', Cancelada: 'Cancelada', 'No asistió': 'No asistió',
}

/** `stage` llega del backend; si una versión anterior no lo envía, se deriva del estado. */
export function stageOf(a: Pick<Appointment, 'status' | 'stage' | 'arrived_at' | 'started_at'>): AppointmentStage {
  if (a.stage) return a.stage
  if (a.status === 'Confirmada' && a.started_at) return 'En consulta'
  if (a.status === 'Confirmada' && a.arrived_at) return 'En sala de espera'
  return fromStatus[a.status]
}

/** Línea de 5 pasos de MASTER §3. */
export const STEPS: AppointmentStage[] = ['Por confirmar', 'Confirmada', 'En sala de espera', 'En consulta', 'Atendida']

export const stageIcon: Record<AppointmentStage, IconName> = {
  'Por confirmar': 'pending', Confirmada: 'confirmed', 'En sala de espera': 'waiting', 'En consulta': 'consult',
  Atendida: 'attended', Cancelada: 'cancelled', 'No asistió': 'noshow',
}

/** Texto para el propietario (MASTER §3). */
export function ownerText(a: Appointment, now?: Date): string {
  const stage = stageOf(a)
  switch (stage) {
    case 'Por confirmar': return 'La veterinaria confirmará tu turno'
    case 'Confirmada': {
      const day = relativeDay(a.starts_at, now)
      const prefix = day === 'Hoy' || day === 'Mañana' || day === 'Ayer' ? day.toLowerCase() : `el ${day}`
      return `Te esperamos ${prefix} a las ${timeOnly(a.starts_at)}`
    }
    case 'En sala de espera': return 'Ya estás registrado. Te llamarán pronto'
    case 'En consulta': return a.vet ? `${a.pet.name} está con ${fullName(a.vet.profile)}` : `${a.pet.name} está en consulta`
    case 'Atendida': return 'Atención registrada. Revisa sus indicaciones'
    case 'Cancelada': return 'Cita cancelada'
    case 'No asistió': return 'No registramos tu llegada'
  }
}

/** «Pagado S/ 65.00 · Yape» o «Pago en la veterinaria» (solo para citas atendidas). */
export const paymentLabel = (a: Appointment) => a.payment ? `Pagado ${money(a.payment.amount)} · ${a.payment.method}` : 'Pago en la veterinaria'

const ACTIVE: AppointmentStage[] = ['Por confirmar', 'Confirmada', 'En sala de espera', 'En consulta']
export const isActive = (a: Appointment) => ACTIVE.includes(stageOf(a))
export const isLive = (a: Appointment) => { const s = stageOf(a); return s === 'En sala de espera' || s === 'En consulta' }

/** El propietario cancela solo antes de llegar (docs/api.md: 409 después de la llegada). */
export const canCancel = (a: Appointment) => {
  const stage = stageOf(a)
  return (stage === 'Por confirmar' || stage === 'Confirmada') && !a.arrived_at
}

/** Próximas: activas que no terminaron. Anteriores: el resto, la más reciente primero. */
export function splitAppointments(list: Appointment[], now: Date = new Date()) {
  const upcoming: Appointment[] = []
  const past: Appointment[] = []
  for (const a of list) {
    const end = new Date(a.starts_at).getTime() + a.service.duration_minutes * 60_000
    if (isActive(a) && (isLive(a) || end > now.getTime())) upcoming.push(a)
    else past.push(a)
  }
  upcoming.sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  past.sort((a, b) => b.starts_at.localeCompare(a.starts_at))
  return { upcoming, past }
}

/** Próxima cita: la que está en curso o la siguiente por empezar. */
export const nextAppointment = (list: Appointment[], now: Date = new Date()) => {
  const { upcoming } = splitAppointments(list, now)
  return upcoming.find(isLive) ?? upcoming[0]
}

/** Última veterinaria usada (para recordarla al pedir turno). */
export const lastClinicId = (list: Appointment[] | undefined) =>
  list?.length ? [...list].sort((a, b) => b.created_at.localeCompare(a.created_at))[0].clinic.id : 0

const SUGGESTED: Record<string, RegExp> = {
  Vacuna: /vacun/i, 'Desparasitación': /desparasit/i, Tratamiento: /control|consulta/i, Control: /control|consulta/i,
}
/** Servicio sugerido para un recordatorio (Vacunación, Desparasitación o Control). */
export function suggestServiceId(services: { id: number; name: string }[], kind: string | undefined) {
  const pattern = kind ? SUGGESTED[kind] : undefined
  return pattern ? services.find(s => pattern.test(s.name))?.id ?? 0 : 0
}
