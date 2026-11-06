import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { KeyRound, LockKeyhole } from 'lucide-react'
import { ErrorState, Field, Notice, PageHeader } from '../components/ui'
import { api, json } from '../lib/api'
import { passwordSchema, type PasswordValues } from '../lib/schemas'
import type { User } from '../lib/types'

export function PasswordForm({ onDone }: { onDone?: () => void }) {
  const client = useQueryClient()
  const [saved, setSaved] = useState(false)
  const { register, handleSubmit, reset, formState: { errors } } = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema) })
  const mutation = useMutation({
    mutationFn: ({ current_password, new_password }: PasswordValues) => api<User>('/auth/password', json('POST', { current_password, new_password })),
    onSuccess: data => { reset(); setSaved(true); client.setQueryData(['me'], data); onDone?.() },
  })
  return <form className="form-grid" noValidate onSubmit={handleSubmit(data => { setSaved(false); mutation.mutate(data) })}>
    {saved && <div className="full"><Notice>Tu contraseña se actualizó. Cerramos tus otras sesiones abiertas.</Notice></div>}
    <Field id="current_password" label="Contraseña actual" error={errors.current_password?.message} full><input id="current_password" type="password" autoComplete="current-password" aria-invalid={!!errors.current_password} {...register('current_password')} /></Field>
    <Field id="new_password" label="Nueva contraseña" hint="Mínimo 10 caracteres." error={errors.new_password?.message}><input id="new_password" type="password" autoComplete="new-password" aria-invalid={!!errors.new_password} {...register('new_password')} /></Field>
    <Field id="confirmation" label="Confirmar nueva contraseña" error={errors.confirmation?.message}><input id="confirmation" type="password" autoComplete="new-password" aria-invalid={!!errors.confirmation} {...register('confirmation')} /></Field>
    {mutation.isError && <div className="full"><ErrorState error={mutation.error} /></div>}
    <div className="form-actions full"><button className="button" disabled={mutation.isPending}><KeyRound size={17} />{mutation.isPending ? 'Guardando…' : 'Cambiar contraseña'}</button></div>
  </form>
}

export function ForcedPasswordChange() {
  return <><PageHeader eyebrow="PRIMER INGRESO" title="Crea tu contraseña personal" description="Tu cuenta fue creada con una contraseña temporal. Reemplázala para continuar." />
    <section className="panel form-panel" style={{ maxWidth: 640 }}><p className="privacy-note" style={{ marginBottom: 18 }}><LockKeyhole size={16} /> Nadie más, ni siquiera quien creó tu cuenta, conocerá tu nueva contraseña.</p><PasswordForm /></section></>
}
