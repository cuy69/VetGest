import { describe, expect, it } from 'vitest'
import { appointmentSchema, clinicSchema, movementSchema, petSchema, registerSchema } from '../lib/schemas'

const account = { first_name: 'Ana', last_name: 'Torres', email: 'ana@example.com', phone: '987654321', password: 'Test-password-123', password_confirmation: 'Test-password-123' }
const pet = { name: 'Luna', species: 'Gato', breed: 'Mestizo', sex: 'Hembra', birth_date: '2022-03-12', weight: 4.5, color: 'Gris', notes: '' }

describe('Validación del registro', () => {
  it('acepta datos completos', () => { expect(registerSchema.safeParse(account).success).toBe(true) })
  it.each([{ email: 'bad-email' }, { password: 'short' }, { password_confirmation: 'different' }, { first_name: '   ' }, { phone: 'abc' }])('rechaza campos inválidos: %o', change => {
    expect(registerSchema.safeParse({ ...account, ...change }).success).toBe(false)
  })
})
describe('Validación de mascota', () => {
  it('acepta una mascota y convierte el peso del formulario', () => { expect(petSchema.parse({ ...pet, weight: '4.5' }).weight).toBe(4.5) })
  it.each([{ name: '' }, { weight: 0 }, { weight: -3 }, { weight: 0.001 }, { weight: '' }, { weight: 'abc' }, { weight: Infinity }, { birth_date: '2999-01-01' }, { birth_date: '2023-02-30' }, { birth_date: '2022-2-03' }, { species: '' }])('rechaza datos inválidos sin lanzar excepciones: %o', change => {
    expect(petSchema.safeParse({ ...pet, ...change }).success).toBe(false)
  })
})
describe('Validación de cita', () => {
  const appointment = { pet_id: 1, clinic_id: 1, service_id: 1, date: '2099-01-01', starts_at: '2099-01-01T10:00:00-05:00', reason: '' }
  it('acepta una cita futura', () => expect(appointmentSchema.safeParse(appointment).success).toBe(true))
  it.each([{ pet_id: 0 }, { clinic_id: 0 }, { service_id: 0 }, { date: '2099-02-31' }, { starts_at: '' }, { starts_at: '2000-01-01T10:00:00-05:00' }])('rechaza una cita inválida: %o', change => expect(appointmentSchema.safeParse({ ...appointment, ...change }).success).toBe(false))
})
describe('Horario de la veterinaria', () => {
  const clinic = { name: 'Huella', address: 'Av. Siempre Viva 123', phone: '987654321', opening_hours: 'Lun a sáb', description: 'Veterinaria de barrio.', opens_at: '08:00', closes_at: '20:00', open_days: [1, 2, 3, 4, 5, 6] }
  it('acepta un horario válido', () => expect(clinicSchema.safeParse(clinic).success).toBe(true))
  it.each([{ closes_at: '07:00' }, { opens_at: '25:00' }, { open_days: [] }])('rechaza %o', change => expect(clinicSchema.safeParse({ ...clinic, ...change }).success).toBe(false))
})
describe('Movimientos de inventario', () => {
  it('un ingreso debe ser positivo y un ajuste distinto de cero', () => {
    expect(movementSchema.safeParse({ kind: 'Ingreso', quantity: 5 }).success).toBe(true)
    expect(movementSchema.safeParse({ kind: 'Ingreso', quantity: -1 }).success).toBe(false)
    expect(movementSchema.safeParse({ kind: 'Ajuste', quantity: -3, notes: 'Vencido' }).success).toBe(true)
    expect(movementSchema.safeParse({ kind: 'Ajuste', quantity: -3 }).success).toBe(false)
    expect(movementSchema.safeParse({ kind: 'Ajuste', quantity: 0 }).success).toBe(false)
  })
})
