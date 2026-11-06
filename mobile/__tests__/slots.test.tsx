import { fireEvent, render, screen } from '@testing-library/react-native'
import { DayStrip, SlotPicker } from '@/components/SlotPicker'
import { canCancel, nextAppointment, stageOf } from '@/lib/appointments'
import { addDays, groupSlots, isoWeekday, isSelectable, nextDays } from '@/lib/slots'
import type { Appointment, Slot } from '@/lib/types'

// Jueves 5 de noviembre de 2026, 09:30 en Lima (-05:00).
const NOW = new Date('2026-11-05T09:30:00-05:00')
const slot = (time: string, available: boolean, date = '2026-11-05'): Slot => ({ starts_at: `${date}T${time}:00-05:00`, available })

describe('fechas y turnos', () => {
  it('calcula días ISO y suma días sin desfase de zona horaria', () => {
    expect(isoWeekday('2026-11-08')).toBe(7) // domingo
    expect(isoWeekday('2026-11-09')).toBe(1) // lunes
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('marca como cerrados los días fuera de open_days (por defecto, lunes a sábado)', () => {
    const days = nextDays(undefined, 7, NOW)
    expect(days[0]).toMatchObject({ date: '2026-11-05', weekday: 'Hoy', open: true })
    expect(days.find(d => d.date === '2026-11-08')?.open).toBe(false)
    const weekdaysOnly = nextDays({ open_days: [1, 2, 3, 4, 5] }, 7, NOW)
    expect(weekdaysOnly.find(d => d.date === '2026-11-07')?.open).toBe(false)
    expect(weekdaysOnly.find(d => d.date === '2026-11-07')?.label).toMatch(/cerrado$/)
  })

  it('un turno solo se elige si está disponible y no pasó', () => {
    expect(isSelectable(slot('10:00', true), NOW)).toBe(true)
    expect(isSelectable(slot('10:00', false), NOW)).toBe(false)
    expect(isSelectable(slot('09:00', true), NOW)).toBe(false)
  })

  it('agrupa por mañana, tarde y noche en orden', () => {
    const groups = groupSlots([slot('18:30', true), slot('14:00', true), slot('08:00', true)])
    expect(groups.map(g => g.title)).toEqual(['Mañana', 'Tarde', 'Noche'])
  })
})

describe('SlotPicker', () => {
  const slots = [slot('09:00', true), slot('10:00', false), slot('10:30', true), slot('15:00', true)]

  it('deshabilita los turnos ocupados o pasados y permite elegir los libres', async () => {
    const onChange = jest.fn()
    await render(<SlotPicker slots={slots} value={null} onChange={onChange} now={NOW} />)
    expect(screen.getByTestId('slot-09:00')).toBeDisabled() // ya pasó
    expect(screen.getByTestId('slot-10:00')).toBeDisabled() // ocupado
    expect(screen.getByLabelText('10:00, no disponible')).toBeTruthy()
    await fireEvent.press(screen.getByTestId('slot-10:00'))
    expect(onChange).not.toHaveBeenCalled()
    await fireEvent.press(screen.getByTestId('slot-10:30'))
    expect(onChange).toHaveBeenCalledWith('2026-11-05T10:30:00-05:00')
  })

  it('marca el turno elegido y avisa si no quedan libres', async () => {
    const { rerender } = await render(<SlotPicker slots={slots} value="2026-11-05T15:00:00-05:00" onChange={() => undefined} now={NOW} />)
    expect(screen.getByTestId('slot-15:00')).toBeChecked()
    await rerender(<SlotPicker slots={[slot('10:00', false)]} value={null} onChange={() => undefined} now={NOW} />)
    expect(screen.getByText('No quedan turnos libres este día. Prueba con otra fecha.')).toBeTruthy()
    await rerender(<SlotPicker slots={[]} value={null} onChange={() => undefined} now={NOW} />)
    expect(screen.getByText('La veterinaria no atiende este día. Elige otra fecha.')).toBeTruthy()
  })

  it('DayStrip no deja elegir días cerrados', async () => {
    const onChange = jest.fn()
    await render(<DayStrip days={nextDays(undefined, 7, NOW)} value="2026-11-05" onChange={onChange} />)
    expect(screen.getByTestId('day-2026-11-08')).toBeDisabled()
    await fireEvent.press(screen.getByTestId('day-2026-11-08'))
    expect(onChange).not.toHaveBeenCalled()
    await fireEvent.press(screen.getByTestId('day-2026-11-06'))
    expect(onChange).toHaveBeenCalledWith('2026-11-06')
  })
})

describe('estado de la cita', () => {
  const base = { id: 1, pet: { name: 'Luna' }, service: { duration_minutes: 30 }, clinic: {}, reason: '', vet: null, has_record: false, created_at: '', updated_at: '' }
  const make = (over: Partial<Appointment>) => ({ ...base, status: 'Pendiente', starts_at: '2026-11-06T10:00:00-05:00', ...over }) as Appointment

  it('usa stage del backend o lo deriva del estado', () => {
    expect(stageOf(make({ stage: 'En consulta', status: 'Confirmada' }))).toBe('En consulta')
    expect(stageOf(make({ status: 'Pendiente' }))).toBe('Por confirmar')
    expect(stageOf(make({ status: 'Confirmada', arrived_at: '2026-11-06T09:55:00-05:00' }))).toBe('En sala de espera')
  })

  it('solo se cancela antes de llegar', () => {
    expect(canCancel(make({ status: 'Confirmada', stage: 'Confirmada' }))).toBe(true)
    expect(canCancel(make({ status: 'Confirmada', stage: 'En sala de espera', arrived_at: 'x' }))).toBe(false)
    expect(canCancel(make({ status: 'Atendida', stage: 'Atendida' }))).toBe(false)
  })

  it('la próxima cita incluye la que está en curso y descarta las pasadas', () => {
    const past = make({ id: 2, starts_at: '2026-11-04T10:00:00-05:00', status: 'Confirmada' })
    const later = make({ id: 3, starts_at: '2026-11-10T10:00:00-05:00' })
    const waiting = make({ id: 4, starts_at: '2026-11-05T09:00:00-05:00', status: 'Confirmada', stage: 'En sala de espera', arrived_at: 'x' })
    expect(nextAppointment([later, past], NOW)?.id).toBe(3)
    expect(nextAppointment([later, past, waiting], NOW)?.id).toBe(4)
  })
})
