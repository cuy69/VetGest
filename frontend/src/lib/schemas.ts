import { z } from 'zod'

export function todayLima() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const part = (type: string) => parts.find(p => p.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

const name = z.string().trim().min(1, 'Este campo es obligatorio.').max(80, 'Usa hasta 80 caracteres.')
const phone = z.string().trim().regex(/^\+?[0-9 ()-]{7,25}$/, 'Ingresa un teléfono válido de 7 a 25 caracteres.')
const email = z.string().trim().email('Ingresa un correo válido.').max(254)
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
  && !Number.isNaN(Date.parse(`${value}T12:00:00Z`))
  && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value
export const profileSchema = z.object({ first_name: name, last_name: name, phone })
export const registerSchema = profileSchema.extend({
  email,
  password: z.string().min(10, 'Usa al menos 10 caracteres.').max(128, 'Usa hasta 128 caracteres.'),
  password_confirmation: z.string().min(1, 'Confirma tu contraseña.'),
}).refine(data => data.password === data.password_confirmation, { message: 'Las contraseñas no coinciden.', path: ['password_confirmation'] })
export const loginSchema = z.object({ email, password: z.string().min(1, 'Ingresa tu contraseña.').max(128) })
export const petSchema = z.object({
  name, species: z.enum(['Perro', 'Gato', 'Ave', 'Conejo', 'Otro'], { message: 'Selecciona una especie.' }),
  breed: name, sex: z.enum(['Macho', 'Hembra'], { message: 'Selecciona el sexo.' }),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ingresa una fecha válida.')
    .refine(validDate, 'Ingresa una fecha válida.')
    .refine(v => v >= '1900-01-01' && v <= todayLima(), 'La fecha debe estar entre 1900 y hoy.'),
  weight: z.coerce.number({ invalid_type_error: 'Ingresa un peso válido.' }).finite().min(0.01, 'El peso debe ser mayor que cero.').max(1000, 'El peso máximo es 1000 kg.').multipleOf(0.01, 'Usa hasta dos decimales.'),
  color: name, notes: z.string().max(2000, 'Usa hasta 2000 caracteres.').default(''),
})
export const appointmentSchema = z.object({
  pet_id: z.coerce.number().int().positive('Selecciona una mascota.'),
  clinic_id: z.coerce.number().int().positive('Selecciona una veterinaria.'),
  service_id: z.coerce.number().int().positive('Selecciona un servicio.'),
  date: z.string().refine(validDate, 'Selecciona una fecha válida.'),
  /** Turno elegido de GET /clinics/{id}/availability (ISO con -05:00). */
  starts_at: z.string().min(1, 'Elige uno de los horarios disponibles.'),
  reason: z.string().max(2000, 'Usa hasta 2000 caracteres.').default(''),
}).refine(data => !data.starts_at || new Date(data.starts_at).getTime() > Date.now(), {
  message: 'Ese horario ya pasó. Elige otro (hora de Lima).', path: ['starts_at'],
})
const password = z.string().min(10, 'Usa al menos 10 caracteres.').max(128, 'Usa hasta 128 caracteres.')
const text = (min: number, max: number) => z.string().trim().min(min, min === 1 ? 'Este campo es obligatorio.' : `Usa al menos ${min} caracteres.`).max(max, `Usa hasta ${max} caracteres.`)
const optionalDate = z.string().refine(v => v === '' || validDate(v), 'Ingresa una fecha válida.')
export const passwordSchema = z.object({
  current_password: z.string().min(1, 'Ingresa tu contraseña actual.').max(128),
  new_password: password, confirmation: z.string().min(1, 'Confirma la nueva contraseña.'),
}).refine(d => d.new_password === d.confirmation, { message: 'Las contraseñas no coinciden.', path: ['confirmation'] })
export const staffSchema = profileSchema.extend({ email, role: z.enum(['admin', 'vet', 'reception'], { message: 'Selecciona un rol.' }), temporary_password: password })
const clinicBaseSchema = z.object({
  name: text(2, 120), address: text(5, 250), phone, opening_hours: text(3, 150), description: text(10, 2000),
})
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Ingresa una hora válida.')
export const clinicSchema = clinicBaseSchema.extend({
  opens_at: hhmm, closes_at: hhmm,
  open_days: z.array(z.number().int().min(1).max(7)).min(1, 'Elige al menos un día de atención.'),
}).refine(d => d.closes_at > d.opens_at, { message: 'La hora de cierre debe ser posterior a la de apertura.', path: ['closes_at'] })
/** El alta desde la plataforma usa el horario por defecto del backend (09:00–18:00, lunes a sábado). */
export const clinicCreateSchema = clinicBaseSchema.extend({ admin: profileSchema.extend({ email, temporary_password: password }) })
export const serviceSchema = z.object({
  name: text(2, 120), description: text(3, 2000),
  duration_minutes: z.coerce.number({ invalid_type_error: 'Ingresa minutos.' }).int('Usa minutos enteros.').min(5, 'Mínimo 5 minutos.').max(600, 'Máximo 600 minutos.'),
  price: z.coerce.number({ invalid_type_error: 'Ingresa un precio.' }).min(0, 'El precio no puede ser negativo.').max(100000).multipleOf(0.01, 'Usa hasta dos decimales.'),
  is_active: z.boolean().default(true),
})
export const careSchema = z.object({
  kind: z.enum(['Vacuna', 'Desparasitación', 'Tratamiento'], { message: 'Selecciona el tipo.' }),
  name: text(2, 120), dose: z.string().max(120).default(''),
  applied_on: z.string().refine(validDate, 'Ingresa una fecha válida.').refine(v => v <= todayLima(), 'No puede ser una fecha futura.'),
  next_due_on: optionalDate.default(''), notes: z.string().max(2000).default(''),
  /** Producto del inventario a descontar; '' = ninguno. */
  inventory_item_id: z.string().regex(/^\d*$/).default(''),
}).refine(d => !d.next_due_on || d.next_due_on >= d.applied_on, { message: 'Debe ser posterior a la aplicación.', path: ['next_due_on'] })
export const recordSchema = z.object({
  reason: text(3, 2000), diagnosis: text(3, 4000), indications: z.string().max(4000).default(''),
  weight: z.union([z.literal(''), z.coerce.number().min(0.01, 'El peso debe ser mayor que cero.').max(1000).multipleOf(0.01, 'Usa hasta dos decimales.')]).default(''),
  next_visit_on: optionalDate.default(''),
})
const money = z.coerce.number({ invalid_type_error: 'Ingresa un monto.' }).finite().min(0.01, 'El monto debe ser mayor que cero.').max(100000, 'Monto demasiado alto.').multipleOf(0.01, 'Usa hasta dos decimales.')
export const paymentAmountSchema = money
export const voidSchema = z.object({ reason: text(3, 500) })
export const inventoryItemSchema = z.object({
  name: text(2, 120),
  category: z.enum(['Vacuna', 'Antiparasitario', 'Medicamento', 'Insumo'], { message: 'Selecciona una categoría.' }),
  unit: text(1, 30),
  min_stock: z.coerce.number({ invalid_type_error: 'Ingresa un número.' }).int('Usa números enteros.').min(0, 'No puede ser negativo.').max(100000),
  initial_stock: z.coerce.number({ invalid_type_error: 'Ingresa un número.' }).int('Usa números enteros.').min(0, 'No puede ser negativo.').max(100000),
})
export const movementSchema = z.object({
  kind: z.enum(['Ingreso', 'Ajuste']),
  quantity: z.coerce.number({ invalid_type_error: 'Ingresa una cantidad.' }).int('Usa números enteros.').min(-100000).max(100000),
  notes: z.string().max(500, 'Usa hasta 500 caracteres.').default(''),
}).refine(d => d.kind === 'Ingreso' ? d.quantity > 0 : d.quantity !== 0, { message: 'Un ingreso debe ser mayor que cero; un ajuste, distinto de cero.', path: ['quantity'] })
  .refine(d => d.kind === 'Ingreso' || d.notes.trim().length >= 3, { message: 'Indica el motivo del ajuste.', path: ['notes'] })
export type InventoryItemValues = z.infer<typeof inventoryItemSchema>
export type MovementValues = z.infer<typeof movementSchema>
export type PasswordValues = z.infer<typeof passwordSchema>
export type StaffValues = z.infer<typeof staffSchema>
export type ClinicValues = z.infer<typeof clinicSchema>
export type ClinicCreateValues = z.infer<typeof clinicCreateSchema>
export type ServiceValues = z.infer<typeof serviceSchema>
export type CareValues = z.infer<typeof careSchema>
export type RecordValues = z.infer<typeof recordSchema>
export type RegisterValues = z.infer<typeof registerSchema>
export type LoginValues = z.infer<typeof loginSchema>
export type ProfileValues = z.infer<typeof profileSchema>
export type PetValues = z.infer<typeof petSchema>
export type AppointmentValues = z.infer<typeof appointmentSchema>
