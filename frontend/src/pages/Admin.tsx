import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { ArrowRight, Building2, CalendarDays, PawPrint, Plus, Save, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge, ConfirmDialog, EmptyState, ErrorState, Field, Loading, Notice, PageHeader } from '../components/ui'
import { api, json } from '../lib/api'
import { useAdminClinics, usePlatformSummary } from '../lib/queries'
import { clinicCreateSchema, type ClinicCreateValues } from '../lib/schemas'
import type { AdminClinic } from '../lib/types'

export function AdminHome() {
  const summary = usePlatformSummary()
  if (summary.isPending) return <Loading />
  if (summary.isError) return <ErrorState error={summary.error} retry={() => void summary.refetch()} />
  const s = summary.data
  const total = Object.values(s.appointments_30d).reduce((a, b) => a + (b ?? 0), 0)
  const attended = s.appointments_30d.Atendida ?? 0
  const noShow = s.appointments_30d['No asistió'] ?? 0
  return <><PageHeader eyebrow="PLATAFORMA" title="Resumen de VetGest" description="Indicadores generales de adopción y uso." action={<Link className="button" to="/admin/clinicas"><Building2 size={18} />Gestionar veterinarias</Link>} />
    <div className="stats-grid">
      <article className="stat-card"><span className="stat-icon teal"><Building2 /></span><div><span>Veterinarias activas</span><strong>{s.active_clinics}</strong></div></article>
      <article className="stat-card"><span className="stat-icon teal"><Users /></span><div><span>Propietarios · personal</span><strong>{s.owners} · {s.staff}</strong></div></article>
      <article className="stat-card"><span className="stat-icon amber"><PawPrint /></span><div><span>Mascotas registradas</span><strong>{s.pets}</strong></div></article>
    </div>
    <section className="panel"><div className="section-heading"><h2 className="heading-icon"><CalendarDays size={18} />Citas de los últimos 30 días</h2><span className="muted">{total} solicitudes</span></div>
      <div className="table-wrap" tabIndex={0} role="region" aria-label="Citas por estado"><table className="data-table"><tbody>{(['Pendiente', 'Confirmada', 'Atendida', 'Cancelada', 'No asistió'] as const).map(k => <tr key={k}><td><Badge status={k} /></td><td>{s.appointments_30d[k] ?? 0}</td></tr>)}
        <tr><td><strong>Tasa de inasistencia</strong></td><td>{attended + noShow ? `${Math.round(noShow / (attended + noShow) * 100)} %` : '—'}</td></tr></tbody></table></div></section>
  </>
}

function ClinicForm({ onDone }: { onDone: (name: string) => void }) {
  const client = useQueryClient()
  const { register, handleSubmit, formState: { errors: e } } = useForm<ClinicCreateValues>({ resolver: zodResolver(clinicCreateSchema) })
  const mutation = useMutation({ mutationFn: (v: ClinicCreateValues) => api<AdminClinic>('/admin/clinics', json('POST', v)), onSuccess: async data => { await client.invalidateQueries({ queryKey: ['admin'] }); onDone(data.name) } })
  return <section className="panel form-panel" style={{ marginBottom: 24 }}><h2>Alta de veterinaria</h2><p className="muted">Se crea la veterinaria y su primer administrador, que deberá cambiar la contraseña temporal al ingresar.</p>
    <form className="form-grid" noValidate onSubmit={handleSubmit(v => mutation.mutate(v))} style={{ marginTop: 16 }}>
      <Field id="name" label="Nombre comercial" error={e.name?.message} full><input id="name" {...register('name')} /></Field>
      <Field id="address" label="Dirección" error={e.address?.message} full><input id="address" {...register('address')} /></Field>
      <Field id="phone" label="Teléfono" error={e.phone?.message}><input id="phone" type="tel" {...register('phone')} /></Field>
      <Field id="opening_hours" label="Horario" error={e.opening_hours?.message}><input id="opening_hours" placeholder="Lunes a sábado, 09:00–18:00" {...register('opening_hours')} /></Field>
      <Field id="description" label="Descripción" error={e.description?.message} full><textarea id="description" rows={3} {...register('description')} /></Field>
      <h3 className="sub full">Administrador de la veterinaria</h3>
      <Field id="admin.first_name" label="Nombres" error={e.admin?.first_name?.message}><input id="admin.first_name" {...register('admin.first_name')} /></Field>
      <Field id="admin.last_name" label="Apellidos" error={e.admin?.last_name?.message}><input id="admin.last_name" {...register('admin.last_name')} /></Field>
      <Field id="admin.email" label="Correo" error={e.admin?.email?.message}><input id="admin.email" type="email" autoComplete="off" {...register('admin.email')} /></Field>
      <Field id="admin.phone" label="Teléfono" error={e.admin?.phone?.message}><input id="admin.phone" type="tel" {...register('admin.phone')} /></Field>
      <Field id="admin.temporary_password" label="Contraseña temporal" hint="Mínimo 10 caracteres." error={e.admin?.temporary_password?.message} full><input id="admin.temporary_password" type="text" autoComplete="off" {...register('admin.temporary_password')} /></Field>
      {mutation.isError && <div className="full"><ErrorState error={mutation.error} /></div>}
      <div className="form-actions full"><button className="button" disabled={mutation.isPending}><Save size={17} />{mutation.isPending ? 'Creando…' : 'Crear veterinaria'}</button></div>
    </form></section>
}

export function AdminClinics() {
  const clinics = useAdminClinics()
  const client = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [notice, setNotice] = useState('')
  const [target, setTarget] = useState<AdminClinic | null>(null)
  const mutation = useMutation({
    mutationFn: (c: AdminClinic) => api<AdminClinic>(`/admin/clinics/${c.id}/status`, json('PATCH', { is_active: !c.is_active })),
    onSuccess: async data => { await client.invalidateQueries({ queryKey: ['admin'] }); setTarget(null); setNotice(`${data.name} ${data.is_active ? 'se reactivó' : 'se suspendió'}.`) },
  })
  return <><PageHeader eyebrow="RED DE VETERINARIAS" title="Veterinarias" description="Da de alta veterinarias aliadas y suspende el acceso cuando corresponda." action={!adding && <button className="button" onClick={() => { setNotice(''); setAdding(true) }}><Plus size={18} />Nueva veterinaria</button>} />
    {notice && <Notice>{notice}</Notice>}
    {adding && <ClinicForm onDone={name => { setAdding(false); setNotice(`${name} se creó con su administrador.`) }} />}
    {clinics.isPending ? <Loading /> : clinics.isError ? <ErrorState error={clinics.error} retry={() => void clinics.refetch()} /> : !clinics.data.length ? <div className="panel"><EmptyState title="Sin veterinarias">Registra la primera veterinaria aliada.</EmptyState></div>
      : <div className="panel table-wrap" tabIndex={0} role="region" aria-label="Veterinarias"><table className="data-table"><thead><tr><th>Veterinaria</th><th>Contacto</th><th>Equipo</th><th>Citas</th><th>Estado</th><th><span className="sr-only">Acciones</span></th></tr></thead><tbody>{clinics.data.map(c => <tr key={c.id}>
        <td><strong>{c.name}</strong><small>{c.address}</small></td><td>{c.phone}</td><td>{c.staff_count}</td><td>{c.appointment_count}</td><td><Badge status={c.is_active ? 'Activa' : 'Suspendida'} /></td>
        <td className="actions"><button className="text-link" onClick={() => { mutation.reset(); setTarget(c) }}>{c.is_active ? 'Suspender' : 'Reactivar'} <ArrowRight size={15} /></button></td></tr>)}</tbody></table></div>}
    <ConfirmDialog open={!!target} title={target?.is_active ? `¿Suspender ${target.name}?` : `¿Reactivar ${target?.name}?`} confirmLabel={target?.is_active ? 'Sí, suspender' : 'Sí, reactivar'} pending={mutation.isPending} onCancel={() => setTarget(null)} onConfirm={() => target && mutation.mutate(target)} error={mutation.error}>
      <p>{target?.is_active ? 'Su equipo perderá el acceso de inmediato y la veterinaria dejará de aparecer en el catálogo. El historial clínico se conserva.' : 'Su equipo podrá volver a ingresar y la veterinaria aparecerá en el catálogo.'}</p></ConfirmDialog>
  </>
}
