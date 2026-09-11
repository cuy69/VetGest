import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowRight, LockKeyhole } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Brand, ErrorState, Field, Notice, petPhoto } from '../components/ui'
import { api, json } from '../lib/api'
import { loginSchema, registerSchema, type LoginValues, type RegisterValues } from '../lib/schemas'
import type { User } from '../lib/types'

function AuthFrame({ children, register = false }: { children: React.ReactNode; register?: boolean }) {
  return <div className="auth-page"><div className="auth-main"><Brand /><div className="auth-content"><p className="eyebrow">BIENVENIDO A SU NUEVO ESPACIO</p><h1>{register ? 'El cuidado empieza aquí.' : 'Qué bueno verte de nuevo.'}</h1><p className="muted">{register ? 'Crea tu cuenta y reúne a toda tu familia de cuatro patas.' : 'Tus compañeros y sus próximos cuidados te esperan.'}</p>{children}</div><p className="auth-footer"><LockKeyhole size={15} /> Tu información, en tu espacio personal.</p></div><aside className="auth-visual"><img src={petPhoto} alt="Un perro junto a un gato, tranquilos en un jardín" /><div><p className="eyebrow">SIEMPRE A SU LADO</p><h2>Para ellos eres<br />todo su mundo.</h2><p>Hagamos que cuidar del suyo sea más sencillo.</p></div></aside></div>
}
export function Register() {
  const navigate = useNavigate()
  const [error, setError] = useState<Error | null>(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) })
  async function submit(data: RegisterValues) {
    setError(null)
    try { await api('/auth/register', json('POST', data)); navigate('/iniciar-sesion', { state: { registered: true }, replace: true }) } catch (e) { setError(e as Error) }
  }
  return <AuthFrame register><form onSubmit={handleSubmit(submit)} noValidate className="form-grid">
    <Field id="first_name" label="Nombres" error={errors.first_name?.message}><input id="first_name" autoComplete="given-name" aria-invalid={!!errors.first_name} aria-describedby={errors.first_name ? 'first_name-error' : undefined} {...register('first_name')} /></Field>
    <Field id="last_name" label="Apellidos" error={errors.last_name?.message}><input id="last_name" autoComplete="family-name" aria-invalid={!!errors.last_name} aria-describedby={errors.last_name ? 'last_name-error' : undefined} {...register('last_name')} /></Field>
    <Field id="email" label="Correo electrónico" error={errors.email?.message} full><input id="email" type="email" autoComplete="email" placeholder="nombre@correo.com" aria-invalid={!!errors.email} aria-describedby={errors.email ? 'email-error' : undefined} {...register('email')} /></Field>
    <Field id="phone" label="Teléfono" error={errors.phone?.message} full><input id="phone" type="tel" autoComplete="tel" placeholder="Ej. 987 654 321" aria-invalid={!!errors.phone} aria-describedby={errors.phone ? 'phone-error' : undefined} {...register('phone')} /></Field>
    <Field id="password" label="Contraseña" error={errors.password?.message} hint="Mínimo 10 caracteres."><input id="password" type="password" autoComplete="new-password" aria-invalid={!!errors.password} aria-describedby={errors.password ? 'password-error password-hint' : 'password-hint'} {...register('password')} /></Field>
    <Field id="password_confirmation" label="Confirmar contraseña" error={errors.password_confirmation?.message}><input id="password_confirmation" type="password" autoComplete="new-password" aria-invalid={!!errors.password_confirmation} aria-describedby={errors.password_confirmation ? 'password_confirmation-error' : undefined} {...register('password_confirmation')} /></Field>
    {error && <div className="full"><ErrorState error={error} /></div>}<button className="button full" disabled={isSubmitting}>{isSubmitting ? 'Creando tu cuenta…' : 'Crear mi cuenta'}<ArrowRight size={18} /></button>
  </form><p className="auth-switch">¿Ya tienes una cuenta? <Link to="/iniciar-sesion">Inicia sesión</Link></p></AuthFrame>
}
export function Login() {
  const location = useLocation()
  const navigate = useNavigate()
  const client = useQueryClient()
  const [error, setError] = useState<Error | null>(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) })
  async function submit(data: LoginValues) {
    setError(null)
    try {
      const user = await api<User>('/auth/login', json('POST', data))
      client.clear(); client.setQueryData(['me'], user)
      const from = location.state?.from
      navigate(typeof from === 'string' && (from === '/app' || from.startsWith('/app/')) ? from : '/app', { replace: true })
    } catch (e) { setError(e as Error) }
  }
  return <AuthFrame>{location.state?.registered && <Notice>Tu cuenta está lista. Inicia sesión para registrar a tu mascota.</Notice>}
    <form onSubmit={handleSubmit(submit)} noValidate className="form-grid">
      <Field id="email" label="Correo electrónico" error={errors.email?.message} full><input id="email" type="email" autoComplete="email" placeholder="nombre@correo.com" aria-invalid={!!errors.email} aria-describedby={errors.email ? 'email-error' : undefined} {...register('email')} /></Field>
      <Field id="password" label="Contraseña" error={errors.password?.message} full><input id="password" type="password" autoComplete="current-password" aria-invalid={!!errors.password} aria-describedby={errors.password ? 'password-error' : undefined} {...register('password')} /></Field>
      {error && <div className="full"><ErrorState error={error} /></div>}<button className="button full" disabled={isSubmitting}>{isSubmitting ? 'Iniciando sesión…' : 'Iniciar sesión'}<ArrowRight size={18} /></button>
    </form><p className="auth-switch">¿Es tu primera visita? <Link to="/registro">Crea tu cuenta</Link></p>
  </AuthFrame>
}
