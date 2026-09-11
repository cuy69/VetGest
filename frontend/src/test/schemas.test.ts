import { describe, expect, it } from 'vitest'
import { appointmentSchema, petSchema, registerSchema } from '../lib/schemas'

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
  const appointment = { pet_id: 1, clinic_id: 1, service_id: 1, date: '2099-01-01', time: '10:00', reason: '' }
  it('acepta una cita futura', () => expect(appointmentSchema.safeParse(appointment).success).toBe(true))
  it.each([{ pet_id: 0 }, { clinic_id: 0 }, { service_id: 0 }, { date: '2000-01-01' }, { date: '2099-02-31' }, { time: '25:61' }])('rechaza una cita inválida: %o', change => expect(appointmentSchema.safeParse({ ...appointment, ...change }).success).toBe(false))
})
