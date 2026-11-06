// Lógica pura del selector de día y turno (probada en __tests__/slots.test.ts).
import { todayLima } from './schemas'
import type { Clinic, Slot } from './types'

export function addDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Día ISO (1 = lunes … 7 = domingo) de una fecha AAAA-MM-DD. */
export function isoWeekday(date: string) {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay()
  return day === 0 ? 7 : day
}

/** Lunes a sábado, como el backend cuando la clínica no define `open_days`. */
export const DEFAULT_OPEN_DAYS = [1, 2, 3, 4, 5, 6]

export interface DayOption { date: string; weekday: string; day: string; month: string; open: boolean; label: string }

/** Próximos `count` días desde hoy (Lima), marcando los que la veterinaria atiende. */
export function nextDays(clinic: Pick<Clinic, 'open_days'> | undefined, count = 14, now: Date = new Date()): DayOption[] {
  const open = clinic?.open_days?.length ? clinic.open_days : DEFAULT_OPEN_DAYS
  const start = todayLima(now)
  return Array.from({ length: count }, (_, i) => {
    const date = addDays(start, i)
    const at = new Date(`${date}T12:00:00Z`)
    const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('es-PE', { timeZone: 'UTC', ...o }).format(at)
    const isOpen = open.includes(isoWeekday(date))
    const long = new Intl.DateTimeFormat('es-PE', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(at)
    return {
      date, open: isOpen,
      weekday: i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : capitalize(fmt({ weekday: 'short' }).replace('.', '')),
      day: fmt({ day: 'numeric' }),
      month: fmt({ month: 'short' }).replace('.', ''),
      label: `${capitalize(long)}${isOpen ? '' : ', cerrado'}`,
    }
  })
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Hora de Lima (HH:MM) y fecha de un instante ISO. */
export function limaParts(value: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value))
  const part = (type: string) => parts.find(p => p.type === type)?.value
  return { date: `${part('year')}-${part('month')}-${part('day')}`, time: `${part('hour')}:${part('minute')}` }
}

/** Un turno se puede elegir si el servidor lo marca disponible y todavía no pasó. */
export const isSelectable = (slot: Slot, now: Date = new Date()) => slot.available && new Date(slot.starts_at).getTime() > now.getTime()

export interface SlotGroup { title: 'Mañana' | 'Tarde' | 'Noche'; slots: Slot[] }
/** Agrupa los turnos por franja para mostrarlos ordenados. */
export function groupSlots(slots: Slot[]): SlotGroup[] {
  const groups: SlotGroup[] = [{ title: 'Mañana', slots: [] }, { title: 'Tarde', slots: [] }, { title: 'Noche', slots: [] }]
  for (const slot of [...slots].sort((a, b) => a.starts_at.localeCompare(b.starts_at))) {
    const hour = Number(limaParts(slot.starts_at).time.slice(0, 2))
    groups[hour < 12 ? 0 : hour < 18 ? 1 : 2].slots.push(slot)
  }
  return groups.filter(g => g.slots.length)
}

/** Primer turno libre de una lista (o `undefined`). */
export const firstFree = (slots: Slot[], now: Date = new Date()) =>
  [...slots].sort((a, b) => a.starts_at.localeCompare(b.starts_at)).find(s => isSelectable(s, now))
