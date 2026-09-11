import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, CalendarPlus, Pencil, Plus, Save, Trash2 } from 'lucide-react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Back, ConfirmDialog, EmptyState, ErrorState, Field, Loading, Notice, PageHeader, PetIcon } from '../components/ui'
import { api, json } from '../lib/api'
import { usePet, usePets } from '../lib/queries'
import { petSchema, todayLima, type PetValues } from '../lib/schemas'
import type { Pet } from '../lib/types'

export function PetList() {
  const pets = usePets()
  const location = useLocation()
  return <><PageHeader eyebrow="TU PEQUEÑA FAMILIA" title="Mis mascotas" description="Cada una es única. Su cuidado también." action={<Link className="button" to="/app/mascotas/nueva"><Plus size={18} />Registrar mascota</Link>} />
    {location.state?.deleted && <Notice>La mascota se eliminó de tu lista.</Notice>}
    {pets.isPending ? <Loading /> : pets.isError ? <ErrorState error={pets.error} retry={() => void pets.refetch()} /> : !pets.data.length ? <div className="panel"><EmptyState title="Todavía no tienes mascotas registradas" action={<Link className="button" to="/app/mascotas/nueva"><Plus size={17} />Registrar mi primera mascota</Link>}>Cuéntanos sobre tu compañero para empezar a organizar sus cuidados.</EmptyState></div> : <div className="pet-grid">{pets.data.map(p => <article className="pet-card" key={p.id}><div className={`pet-cover ${p.species === 'Gato' ? 'cat-cover' : ''}`}><span><PetIcon species={p.species} size={64} /></span><span className="species-tag">{p.species}</span></div><div className="pet-card-body"><h2>{p.name}</h2><p className="muted">{p.breed} · {p.sex}</p><div className="pet-facts"><span><small>Peso</small><strong>{p.weight} kg</strong></span><span><small>Color</small><strong>{p.color}</strong></span></div><Link className="card-link" to={`/app/mascotas/${p.id}`}>Ver su perfil <ArrowRight size={18} /></Link></div></article>)}</div>}
  </>
}

function PetEditor({ pet }: { pet?: Pet }) {
  const client = useQueryClient()
  const navigate = useNavigate()
  const { register, handleSubmit, formState: { errors } } = useForm<PetValues>({ resolver: zodResolver(petSchema), defaultValues: pet ? { name: pet.name, species: pet.species, breed: pet.breed, sex: pet.sex, birth_date: pet.birth_date, weight: pet.weight, color: pet.color, notes: pet.notes } : { notes: '' } })
  const mutation = useMutation({ mutationFn: (values: PetValues) => api<Pet>(pet ? `/pets/${pet.id}` : '/pets', json(pet ? 'PUT' : 'POST', values)), onSuccess: async data => { await client.invalidateQueries({ queryKey: ['pets'] }); await client.invalidateQueries({ queryKey: ['appointments'] }); navigate(`/app/mascotas/${data.id}`, { replace: true, state: { saved: true } }) } })
  return <section className="panel form-panel pet-form"><div className="form-section-title"><span className="stat-icon teal"><PetIcon species={pet?.species ?? 'Otro'} /></span><div><h2>Conozcamos a tu compañero</h2><p className="muted">Completa sus datos. Podrás actualizarlos cuando quieras.</p></div></div><form className="form-grid" noValidate onSubmit={handleSubmit(data => mutation.mutate(data))}>
    <Field id="name" label="Nombre" error={errors.name?.message} full><input id="name" placeholder="¿Cómo se llama tu mascota?" maxLength={80} aria-invalid={!!errors.name} aria-describedby={errors.name ? 'name-error' : undefined} {...register('name')} /></Field>
    <Field id="species" label="Especie" error={errors.species?.message}><select id="species" aria-invalid={!!errors.species} aria-describedby={errors.species ? 'species-error' : undefined} {...register('species')}><option value="">Selecciona una especie</option>{['Perro', 'Gato', 'Ave', 'Conejo', 'Otro'].map(s => <option key={s}>{s}</option>)}</select></Field>
    <Field id="breed" label="Raza" hint="Si no la conoces, puedes indicar Mestizo o Desconocida." error={errors.breed?.message}><input id="breed" placeholder="Ej. Mestizo" aria-invalid={!!errors.breed} aria-describedby={errors.breed ? 'breed-error breed-hint' : 'breed-hint'} {...register('breed')} /></Field>
    <Field id="sex" label="Sexo" error={errors.sex?.message}><select id="sex" aria-invalid={!!errors.sex} aria-describedby={errors.sex ? 'sex-error' : undefined} {...register('sex')}><option value="">Selecciona el sexo</option><option>Macho</option><option>Hembra</option></select></Field>
    <Field id="birth_date" label="Fecha de nacimiento aproximada" error={errors.birth_date?.message}><input id="birth_date" type="date" min="1900-01-01" max={todayLima()} aria-invalid={!!errors.birth_date} aria-describedby={errors.birth_date ? 'birth_date-error' : undefined} {...register('birth_date')} /></Field>
    <Field id="weight" label="Peso (kg)" error={errors.weight?.message}><input id="weight" type="number" inputMode="decimal" min="0.01" max="1000" step="0.01" placeholder="Ej. 8.5" aria-invalid={!!errors.weight} aria-describedby={errors.weight ? 'weight-error' : undefined} {...register('weight')} /></Field>
    <Field id="color" label="Color" error={errors.color?.message}><input id="color" placeholder="Ej. Blanco y café" aria-invalid={!!errors.color} aria-describedby={errors.color ? 'color-error' : undefined} {...register('color')} /></Field>
    <Field id="notes" label="Observaciones (opcional)" error={errors.notes?.message} full><textarea id="notes" rows={4} placeholder="Algo que debamos saber sobre tu mascota…" maxLength={2000} aria-invalid={!!errors.notes} aria-describedby={errors.notes ? 'notes-error' : undefined} {...register('notes')} /></Field>
    {mutation.isError && <div className="full"><ErrorState error={mutation.error} /></div>}<div className="form-actions full"><Link className="button secondary" to={pet ? `/app/mascotas/${pet.id}` : '/app/mascotas'}>Volver</Link><button className="button" disabled={mutation.isPending}><Save size={17} />{mutation.isPending ? 'Guardando…' : pet ? 'Guardar cambios' : 'Registrar mascota'}</button></div>
  </form></section>
}
export function PetForm() {
  const { id } = useParams()
  const pet = usePet(id)
  return <><Back to={id ? `/app/mascotas/${id}` : '/app/mascotas'}>Volver a mis mascotas</Back><PageHeader title={id ? 'Editar mascota' : 'Un nuevo compañero'} description="Su información, siempre cerca de ti." />{id && pet.isPending ? <Loading /> : id && pet.isError ? <ErrorState error={pet.error} retry={() => void pet.refetch()} /> : <PetEditor key={id ?? 'new'} pet={id ? pet.data : undefined} />}</>
}
export function PetDetail() {
  const { id } = useParams()
  const pet = usePet(id)
  const client = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const [confirm, setConfirm] = useState(false)
  const mutation = useMutation({ mutationFn: () => api(`/pets/${id}`, json('DELETE')), onSuccess: async () => { await client.invalidateQueries({ queryKey: ['pets'] }); navigate('/app/mascotas', { state: { deleted: true }, replace: true }) } })
  if (pet.isPending) return <Loading />
  if (pet.isError) return <ErrorState error={pet.error} retry={() => void pet.refetch()} />
  const p = pet.data
  return <><Back to="/app/mascotas">Mis mascotas</Back><PageHeader title={`Conoce a ${p.name}`} description="Su pequeño espacio de cuidado." action={<Link className="button secondary" to={`/app/mascotas/${id}/editar`}><Pencil size={17} />Editar datos</Link>} />{location.state?.saved && <Notice>Los datos de tu mascota se guardaron correctamente.</Notice>}<div className="pet-detail-layout"><aside className="panel pet-identity"><span className="pet-avatar huge"><PetIcon species={p.species} size={86} /></span><h2>{p.name}</h2><p>{p.species} · {p.breed}</p><span className="badge owner-badge">{p.sex}</span><Link className="button" to={`/app/citas/nueva?pet=${p.id}`}><CalendarPlus size={18} />Solicitar cita</Link></aside><section className="panel detail-panel"><h2>Sus datos</h2><dl className="detail-grid">{[['Nombre', p.name], ['Especie', p.species], ['Raza', p.breed], ['Sexo', p.sex], ['Nacimiento aproximado', new Intl.DateTimeFormat('es-PE', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${p.birth_date}T12:00:00Z`))], ['Peso', `${p.weight} kg`], ['Color', p.color]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><div className="notes-section"><h3>Observaciones</h3><p>{p.notes || 'No has añadido observaciones.'}</p></div></section></div><div className="delete-zone"><p>¿Necesitas quitar a {p.name} de tu lista?</p><button className="danger-link" onClick={() => { mutation.reset(); setConfirm(true) }}><Trash2 size={16} />Eliminar mascota</button></div><ConfirmDialog open={confirm} title={`¿Eliminar a ${p.name}?`} confirmLabel="Sí, eliminar mascota" pending={mutation.isPending} onCancel={() => setConfirm(false)} onConfirm={() => mutation.mutate()} error={mutation.error}><p>Dejará de aparecer en tus mascotas. Las citas canceladas se conservarán. Si tiene citas pendientes, primero deberás cancelarlas.</p></ConfirmDialog></>
}
