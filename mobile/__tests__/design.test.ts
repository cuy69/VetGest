import { ownerText, paymentLabel, splitAppointments, suggestServiceId } from '@/lib/appointments'
import { age, doseStatus, money, relativeDay, updatedAgo, when } from '@/lib/format'
import { firstFree } from '@/lib/slots'
import { createApiClient } from '@/lib/api'
import type { Appointment } from '@/lib/types'

const NOW = new Date('2026-11-05T09:30:00-05:00') // jueves

const make = (over: Partial<Appointment>) => ({
  id: 1, pet: { name: 'Luna' }, service: { duration_minutes: 30, name: 'Consulta general' }, clinic: { id: 7 }, reason: '', vet: null,
  has_record: false, created_at: '2026-11-01T10:00:00-05:00', updated_at: '', status: 'Pendiente', starts_at: '2026-11-12T10:00:00-05:00', ...over,
}) as Appointment

describe('formatos de MASTER §4.8', () => {
  it('montos S/ con separador de miles y dos decimales', () => {
    expect(money(65)).toBe('S/ 65.00')
    expect(money(1234.5)).toBe('S/ 1 234.50')
  })
  it('fechas relativas y horas en 24 h de Lima', () => {
    expect(relativeDay('2026-11-05T18:00:00-05:00', NOW)).toBe('Hoy')
    expect(relativeDay('2026-11-06T08:00:00-05:00', NOW)).toBe('Mañana')
    expect(when('2026-11-12T16:30:00-05:00', NOW)).toMatch(/^jue 12 nov · 16:30$/)
  })
  it('«Actualizado hace X min», edad y estado de dosis', () => {
    expect(updatedAgo(NOW.getTime() - 3 * 60_000, NOW.getTime())).toBe('Actualizado hace 3 min')
    expect(age('2022-03-12', NOW)).toBe('4 años')
    expect(age('2026-08-01', NOW)).toBe('3 meses')
    expect(doseStatus('2026-11-01', NOW)).toBe('Vencida')
    expect(doseStatus('2026-11-20', NOW)).toBe('Por vencer')
    expect(doseStatus('2027-03-01', NOW)).toBe('Al día')
  })
})

describe('textos para el propietario (MASTER §3)', () => {
  it('usa el texto de cada estado', () => {
    expect(ownerText(make({}), NOW)).toBe('La veterinaria confirmará tu turno')
    expect(ownerText(make({ status: 'Confirmada', stage: 'Confirmada' }), NOW)).toMatch(/^Te esperamos el jue 12 nov a las 10:00$/)
    expect(ownerText(make({ status: 'Confirmada', stage: 'En consulta', vet: { id: 1, profile: { first_name: 'Rosa', last_name: 'Díaz', phone: '' } } }), NOW)).toBe('Luna está con Rosa Díaz')
    expect(ownerText(make({ status: 'No asistió' }), NOW)).toBe('No registramos tu llegada')
  })
  it('pago de citas atendidas', () => {
    expect(paymentLabel(make({ status: 'Atendida', payment: { id: 1, amount: 65, method: 'Yape', paid_at: '' } }))).toBe('Pagado S/ 65.00 · Yape')
    expect(paymentLabel(make({ status: 'Atendida', payment: null }))).toBe('Pago en la veterinaria')
  })
  it('separa próximas y anteriores', () => {
    const { upcoming, past } = splitAppointments([
      make({ id: 1 }), make({ id: 2, starts_at: '2026-11-01T10:00:00-05:00', status: 'Atendida' }), make({ id: 3, status: 'Cancelada' }),
    ], NOW)
    expect(upcoming.map(a => a.id)).toEqual([1])
    expect(past.map(a => a.id)).toEqual([3, 2])
  })
  it('sugiere el servicio del recordatorio', () => {
    const services = [{ id: 1, name: 'Consulta general' }, { id: 2, name: 'Vacunación' }, { id: 3, name: 'Desparasitación interna' }]
    expect(suggestServiceId(services, 'Vacuna')).toBe(2)
    expect(suggestServiceId(services, 'Desparasitación')).toBe(3)
    expect(suggestServiceId(services, 'Control')).toBe(1)
    expect(suggestServiceId(services, undefined)).toBe(0)
  })
})

describe('primer turno libre y servidor dormido', () => {
  it('elige el primer turno disponible y futuro', () => {
    expect(firstFree([
      { starts_at: '2026-11-05T11:00:00-05:00', available: true },
      { starts_at: '2026-11-05T09:00:00-05:00', available: true },
      { starts_at: '2026-11-05T10:00:00-05:00', available: false },
    ], NOW)?.starts_at).toBe('2026-11-05T11:00:00-05:00')
  })
  it('avisa cuando una petición tarda (Render despertando)', async () => {
    jest.useFakeTimers()
    const onSlow = jest.fn()
    let resolve!: (r: Response) => void
    const fetchImpl = (() => new Promise<Response>(r => { resolve = r })) as unknown as typeof fetch
    const client = createApiClient({ baseUrl: 'http://x/api', getToken: () => null, fetchImpl, onSlow, slowAfterMs: 4000 })
    const pending = client('/clinics')
    await Promise.resolve()
    jest.advanceTimersByTime(4000)
    expect(onSlow).toHaveBeenLastCalledWith(1)
    resolve(new Response('[]', { status: 200 }))
    await pending
    expect(onSlow).toHaveBeenLastCalledWith(-1)
    jest.useRealTimers()
  })
})
