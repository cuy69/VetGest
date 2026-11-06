export const dateTime = (value: string) => new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value))
/** «S/ 1 234.50» (MASTER §4.8): miles con espacio fino, punto decimal. */
export function money(value: number) {
  const n = Number(value) || 0
  const [int, dec] = Math.abs(n).toFixed(2).split('.')
  return `${n < 0 ? '−' : ''}S/ ${int.replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f')}.${dec}`
}
export const longDate = (value: string) => new Intl.DateTimeFormat('es-PE', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`))
export const timeOnly = (value: string) => new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value))
export const fullName = (p: { first_name: string; last_name: string }) => `${p.first_name} ${p.last_name}`
export const roleLabel = { owner: 'Propietario', platform_admin: 'Administración VetGest', admin: 'Administrador de veterinaria', vet: 'Veterinario', reception: 'Recepción' } as const
/** Lima wall-clock date and time from an ISO instant, for date/time inputs. */
export function limaParts(value: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value))
  const part = (type: string) => parts.find(p => p.type === type)?.value
  return { date: `${part('year')}-${part('month')}-${part('day')}`, time: `${part('hour')}:${part('minute')}` }
}
const DAY_NAMES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
export const dayName = (iso: number) => DAY_NAMES[iso - 1] ?? ''
/** «lunes a sábado» si los días son consecutivos; si no, lista. */
export function daysLabel(days: number[] | undefined) {
  const d = [...new Set(days ?? [])].filter(n => n >= 1 && n <= 7).sort((a, b) => a - b)
  if (!d.length) return 'sin días de atención'
  if (d.length > 2 && d[d.length - 1] - d[0] === d.length - 1) return `${dayName(d[0])} a ${dayName(d[d.length - 1])}`
  return d.map(dayName).join(', ')
}
/** Día ISO (1 = lunes) de una fecha AAAA-MM-DD. */
export const isoWeekday = (date: string) => { const day = new Date(`${date}T12:00:00Z`).getUTCDay(); return day === 0 ? 7 : day }
export const hhmm = (value: string | undefined, fallback: string) => (value ?? fallback).slice(0, 5)
/** Minutos transcurridos desde `since` hasta `now`, legibles. */
export function elapsed(since: string, now: number) {
  const minutes = Math.max(0, Math.floor((now - new Date(since).getTime()) / 60_000))
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`
}
/** Nombre de quien registró algo: el contrato no fija si es texto o {profile}. */
export function personName(value: unknown) {
  if (!value) return '—'
  if (typeof value === 'string') return value
  if (typeof value === 'object' && value && 'profile' in value) return fullName((value as { profile: { first_name: string; last_name: string } }).profile)
  if (typeof value === 'object' && value && 'first_name' in value) return fullName(value as { first_name: string; last_name: string })
  return '—'
}
/** Etapa visible de la cita; si el servidor aún no envía `stage`, se deriva de estado y marcas de tiempo. */
export function stageOf(a: { status: string; stage?: string | null; arrived_at?: string | null; started_at?: string | null }) {
  if (a.stage) return a.stage
  if (a.status === 'Pendiente') return 'Por confirmar'
  if (a.status === 'Confirmada') return a.started_at ? 'En consulta' : a.arrived_at ? 'En sala de espera' : 'Confirmada'
  return a.status
}
const limaDay = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso))
const shortDay = (date: string) => new Intl.DateTimeFormat('es-PE', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${date}T12:00:00Z`)).replace(/\./g, '')
/** Suma días a una fecha AAAA-MM-DD. */
export const addDays = (date: string, days: number) => { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10) }
/** «Hoy», «Mañana», «Ayer» o «jue 12 nov» para una fecha AAAA-MM-DD (Lima). */
export function relativeDate(date: string) {
  const today = limaDay(new Date().toISOString())
  if (date === today) return 'Hoy'
  if (date === addDays(today, 1)) return 'Mañana'
  if (date === addDays(today, -1)) return 'Ayer'
  return shortDay(date)
}
/** «Hoy · 10:30», «jue 12 nov · 16:00». */
export const relativeDateTime = (iso: string) => `${relativeDate(limaDay(iso))} · ${timeOnly(iso)}`
/** Texto para el propietario por etapa (MASTER §3). */
export function ownerStageText(a: { status: string; stage?: string | null; arrived_at?: string | null; started_at?: string | null; starts_at: string; pet: { name: string }; vet: { profile: { first_name: string; last_name: string } } | null; payment?: { amount: number; method: string } | null }) {
  switch (stageOf(a)) {
    case 'Por confirmar': return 'La veterinaria confirmará tu turno.'
    case 'Confirmada': return `Te esperamos ${relativeDate(limaDay(a.starts_at)).toLowerCase() === 'hoy' ? 'hoy' : relativeDate(limaDay(a.starts_at)) === 'Mañana' ? 'mañana' : `el ${relativeDate(limaDay(a.starts_at))}`} a las ${timeOnly(a.starts_at)}.`
    case 'En sala de espera': return 'Ya estás registrado. Te llamarán pronto.'
    case 'En consulta': return a.vet ? `${a.pet.name} está con ${fullName(a.vet.profile)}.` : `${a.pet.name} está en consulta.`
    case 'Atendida': return a.payment ? `Atención registrada. Pagado ${money(a.payment.amount)} · ${a.payment.method}.` : 'Atención registrada. Revisa sus indicaciones.'
    case 'Cancelada': return 'Cita cancelada.'
    case 'No asistió': return 'No registramos tu llegada.'
    default: return ''
  }
}
