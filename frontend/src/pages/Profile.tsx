import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { LockKeyhole, Save } from 'lucide-react'
import { ErrorState, Field, Loading, Notice, PageHeader } from '../components/ui'
import { api, json } from '../lib/api'
import { useMe } from '../lib/queries'
import { profileSchema, type ProfileValues } from '../lib/schemas'
import type { User } from '../lib/types'

function ProfileForm({ user }: { user: User }) {
  const client = useQueryClient()
  const [saved, setSaved] = useState(false)
  const { register, handleSubmit, formState: { errors, isDirty }, reset } = useForm<ProfileValues>({ resolver: zodResolver(profileSchema), defaultValues: user.profile })
  const mutation = useMutation({ mutationFn: (data: ProfileValues) => api<User>('/auth/profile', json('PATCH', data)), onSuccess: data => { client.setQueryData(['me'], data); reset(data.profile); setSaved(true) } })
  return <div className="profile-layout"><aside className="panel profile-summary"><span className="avatar big">{user.profile.first_name[0]}{user.profile.last_name[0]}</span><h2>{user.profile.first_name} {user.profile.last_name}</h2><p>Propietario de mascota</p><span className="badge owner-badge">Mi cuenta</span></aside><section className="panel form-panel"><h2>Información personal</h2><p className="muted">Mantén tus datos de contacto actualizados.</p>{saved && <Notice>Tus datos se guardaron correctamente.</Notice>}<form className="form-grid" noValidate onSubmit={handleSubmit(data => { setSaved(false); mutation.mutate(data) })}>
    <Field id="first_name" label="Nombres" error={errors.first_name?.message}><input id="first_name" autoComplete="given-name" aria-invalid={!!errors.first_name} aria-describedby={errors.first_name ? 'first_name-error' : undefined} {...register('first_name')} /></Field>
    <Field id="last_name" label="Apellidos" error={errors.last_name?.message}><input id="last_name" autoComplete="family-name" aria-invalid={!!errors.last_name} aria-describedby={errors.last_name ? 'last_name-error' : undefined} {...register('last_name')} /></Field>
    <Field id="email" label="Correo electrónico" hint="El correo identifica tu cuenta y no se puede modificar en esta versión." full><input id="email" value={user.email} readOnly aria-describedby="email-hint" /></Field>
    <Field id="phone" label="Teléfono" error={errors.phone?.message} full><input id="phone" type="tel" autoComplete="tel" aria-invalid={!!errors.phone} aria-describedby={errors.phone ? 'phone-error' : undefined} {...register('phone')} /></Field>
    {mutation.isError && <div className="full"><ErrorState error={mutation.error} /></div>}<div className="form-actions full"><button className="button" disabled={mutation.isPending || !isDirty}><Save size={17} />{mutation.isPending ? 'Guardando…' : 'Guardar cambios'}</button></div>
  </form><p className="privacy-note"><LockKeyhole size={16} /> Solo tú puedes consultar y actualizar estos datos.</p></section></div>
}
export function Profile() {
  const me = useMe()
  return <><PageHeader title="Mi perfil" description="Un espacio para tu información personal." />{me.data ? <ProfileForm user={me.data} /> : <Loading />}</>
}
