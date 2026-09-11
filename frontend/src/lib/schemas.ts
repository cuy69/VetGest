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
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Selecciona una hora válida.'),
  reason: z.string().max(2000, 'Usa hasta 2000 caracteres.').default(''),
}).refine(data => new Date(`${data.date}T${data.time}:00-05:00`).getTime() > Date.now(), {
  message: 'Elige una fecha y hora futuras (hora de Lima).', path: ['date'],
})
export type RegisterValues = z.infer<typeof registerSchema>
export type LoginValues = z.infer<typeof loginSchema>
export type ProfileValues = z.infer<typeof profileSchema>
export type PetValues = z.infer<typeof petSchema>
export type AppointmentValues = z.infer<typeof appointmentSchema>
