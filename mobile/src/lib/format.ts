// Formatos de MASTER §4.8: horas 24 h de Lima, fechas relativas y montos «S/ 1 234.50».
import { todayLima } from './schemas'

const lima = (value: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', ...o }).format(new Date(value))

export const dateTime = (value: string) => `${lima(value, { day: 'numeric', month: 'long', year: 'numeric' })}, ${timeOnly(value)}`
export const timeOnly = (value: string) => lima(value, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
export const longDate = (value: string) => new Intl.DateTimeFormat('es-PE', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`))
export const fullName = (p: { first_name: string; last_name: string }) => `${p.first_name} ${p.last_name}`

/** S/ 1 234.50 (espacio fino como separador de miles, punto decimal). */
export function money(value: number) {
  const [int, dec] = Math.abs(value).toFixed(2).split('.')
  return `${value < 0 ? '−' : ''}S/ ${int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}.${dec}`
}

const limaDate = (value: string) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value))
  const part = (type: string) => parts.find(p => p.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}
const diffDays = (a: string, b: string) => Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86_400_000)

/** «Hoy», «Mañana», «Ayer» o «jue 12 nov» para un instante ISO (Lima). */
export function relativeDay(value: string, now: Date = new Date()) {
  const date = limaDate(value)
  const diff = diffDays(date, todayLima(now))
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Mañana'
  if (diff === -1) return 'Ayer'
  const short = new Intl.DateTimeFormat('es-PE', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${date}T12:00:00Z`))
  return short.replace(/\./g, '').replace(',', '')
}
/** «Hoy · 16:30», «jue 12 nov · 10:00». */
export const when = (value: string, now?: Date) => `${relativeDay(value, now)} · ${timeOnly(value)}`

/** «Actualizado hace X min» (MASTER §4.7). */
export function updatedAgo(timestamp: number, now: number = Date.now()) {
  if (!timestamp) return ''
  const min = Math.floor((now - timestamp) / 60_000)
  return min < 1 ? 'Actualizado hace menos de 1 min' : `Actualizado hace ${min} min`
}

/** Edad aproximada a partir de la fecha de nacimiento. */
export function age(birthDate: string, now: Date = new Date()) {
  const today = todayLima(now)
  const [y, m, d] = birthDate.split('-').map(Number)
  const [ty, tm, td] = today.split('-').map(Number)
  let months = (ty - y) * 12 + (tm - m) - (td < d ? 1 : 0)
  if (months < 0) months = 0
  if (months < 12) return months === 1 ? '1 mes' : `${months} meses`
  const years = Math.floor(months / 12)
  return years === 1 ? '1 año' : `${years} años`
}

/** Estado de una próxima dosis para el carnet. */
export function doseStatus(nextDue: string, now: Date = new Date()): 'Al día' | 'Por vencer' | 'Vencida' {
  const diff = diffDays(nextDue.slice(0, 10), todayLima(now))
  return diff < 0 ? 'Vencida' : diff <= 30 ? 'Por vencer' : 'Al día'
}
