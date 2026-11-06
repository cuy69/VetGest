import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { ArrowRight, ChartColumn, History as HistoryIcon, Package, PackagePlus, Pencil, Plus, Receipt, Save, SlidersHorizontal, TriangleAlert, UserPlus, UserX, Wallet } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { Badge, EmptyState, ErrorState, Field, Loading, Notice, PageHeader } from '../components/ui'
import { api, json } from '../lib/api'
import { addDays, dateTime, dayName, fullName, hhmm, longDate, money, personName, relativeDate, roleLabel } from '../lib/format'
import { useClinicServices, useIncomeReport, useInventory, useMe, useMovements, useMyClinic, useStaff } from '../lib/queries'
import { clinicSchema, inventoryItemSchema, movementSchema, serviceSchema, staffSchema, todayLima, type ClinicValues, type InventoryItemValues, type MovementValues, type ServiceValues, type StaffValues } from '../lib/schemas'
import type { ClinicRole, IncomeBreakdown, IncomeReport as IncomeReportData, InventoryItem, Service, StaffMember } from '../lib/types'

function StaffForm({ onDone }: { onDone: (email: string) => void }) {
  const client = useQueryClient()
  const { register, handleSubmit, formState: { errors: e } } = useForm<StaffValues>({ resolver: zodResolver(staffSchema), defaultValues: { role: 'reception' } })
  const mutation = useMutation({ mutationFn: (v: StaffValues) => api<StaffMember>('/clinic/staff', json('POST', v)), onSuccess: async data => { await client.invalidateQueries({ queryKey: ['clinic', 'staff'] }); onDone(data.email) } })
  return <section className="panel form-panel" style={{ marginBottom: 24 }}><h2>Nuevo miembro del equipo</h2><p className="muted">Comparte la contraseña temporal en persona; se le pedirá cambiarla al ingresar.</p>
    <form className="form-grid" noValidate onSubmit={handleSubmit(v => mutation.mutate(v))} style={{ marginTop: 16 }}>
      <Field id="first_name" label="Nombres" error={e.first_name?.message}><input id="first_name" {...register('first_name')} /></Field>
      <Field id="last_name" label="Apellidos" error={e.last_name?.message}><input id="last_name" {...register('last_name')} /></Field>
      <Field id="email" label="Correo" error={e.email?.message}><input id="email" type="email" autoComplete="off" {...register('email')} /></Field>
      <Field id="phone" label="Teléfono" error={e.phone?.message}><input id="phone" type="tel" {...register('phone')} /></Field>
      <Field id="role" label="Rol" error={e.role?.message}><select id="role" {...register('role')}><option value="reception">Recepción</option><option value="vet">Veterinario</option><option value="admin">Administrador de veterinaria</option></select></Field>
      <Field id="temporary_password" label="Contraseña temporal" hint="Mínimo 10 caracteres." error={e.temporary_password?.message}><input id="temporary_password" type="text" autoComplete="off" {...register('temporary_password')} /></Field>
      {mutation.isError && <div className="full"><ErrorState error={mutation.error} /></div>}
      <div className="form-actions full"><button className="button" disabled={mutation.isPending}><UserPlus size={17} />{mutation.isPending ? 'Creando…' : 'Crear cuenta'}</button></div>
    </form></section>
}

export function Team() {
  const me = useMe()
  const staff = useStaff()
  const client = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [notice, setNotice] = useState('')
  const mutation = useMutation({
    mutationFn: ({ user_id, role, is_active }: { user_id: number; role: ClinicRole; is_active: boolean }) => api(`/clinic/staff/${user_id}`, json('PATCH', { role, is_active })),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ['clinic', 'staff'] }); setNotice('Cambios guardados.') },
  })
  return <><PageHeader eyebrow="PERSONAS Y PERMISOS" title="Equipo" description="Recepción gestiona la agenda; veterinarios registran atenciones; administradores además gestionan equipo y servicios." action={!adding && <button className="button" onClick={() => { setNotice(''); setAdding(true) }}><Plus size={18} />Añadir miembro</button>} />
    {notice && <Notice>{notice}</Notice>}{mutation.isError && <ErrorState error={mutation.error} />}
    {adding && <StaffForm onDone={email => { setAdding(false); setNotice(`Cuenta creada para ${email}.`) }} />}
    {staff.isPending ? <Loading /> : staff.isError ? <ErrorState error={staff.error} retry={() => void staff.refetch()} /> : <div className="panel table-wrap" tabIndex={0} role="region" aria-label="Equipo"><table className="data-table"><thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th><span className="sr-only">Acciones</span></th></tr></thead><tbody>
      {staff.data.map(s => { const self = s.user_id === me.data?.id; return <tr key={s.user_id}>
        <td><strong>{fullName(s.profile)}</strong><small>{s.profile.phone}</small></td><td>{s.email}</td>
        <td>{self ? roleLabel[s.role] : <select aria-label={`Rol de ${fullName(s.profile)}`} value={s.role} disabled={mutation.isPending} onChange={e => mutation.mutate({ user_id: s.user_id, role: e.target.value as ClinicRole, is_active: s.is_active })}><option value="reception">Recepción</option><option value="vet">Veterinario</option><option value="admin">Administrador</option></select>}</td>
        <td><Badge status={s.is_active ? 'Activa' : 'Inactivo'} /></td>
        <td className="actions">{self ? <span className="muted">Tú</span> : <button className="text-link" disabled={mutation.isPending} onClick={() => mutation.mutate({ user_id: s.user_id, role: s.role, is_active: !s.is_active })}>{s.is_active ? 'Desactivar' : 'Reactivar'}</button>}</td>
      </tr> })}</tbody></table></div>}
  </>
}

function ServiceForm({ service, onDone }: { service?: Service; onDone: () => void }) {
  const client = useQueryClient()
  const { register, handleSubmit, formState: { errors: e } } = useForm<ServiceValues>({ resolver: zodResolver(serviceSchema), defaultValues: service ?? { is_active: true } })
  const mutation = useMutation({ mutationFn: (v: ServiceValues) => api(service ? `/clinic/services/${service.id}` : '/clinic/services', json(service ? 'PUT' : 'POST', v)), onSuccess: async () => { await client.invalidateQueries({ queryKey: ['clinic', 'services'] }); await client.invalidateQueries({ queryKey: ['services'] }); onDone() } })
  return <section className="panel form-panel" style={{ marginBottom: 24 }}><h2>{service ? `Editar ${service.name}` : 'Nuevo servicio'}</h2>
    <form className="form-grid" noValidate onSubmit={handleSubmit(v => mutation.mutate(v))} style={{ marginTop: 16 }}>
      <Field id="name" label="Nombre" error={e.name?.message} full><input id="name" {...register('name')} /></Field>
      <Field id="description" label="Descripción" error={e.description?.message} full><textarea id="description" rows={3} {...register('description')} /></Field>
      <Field id="duration_minutes" label="Duración (minutos)" error={e.duration_minutes?.message}><input id="duration_minutes" type="number" min={5} max={600} {...register('duration_minutes')} /></Field>
      <Field id="price" label="Precio referencial (S/)" error={e.price?.message}><input id="price" type="number" min={0} step="0.01" {...register('price')} /></Field>
      <label className="check full"><input type="checkbox" {...register('is_active')} />Visible para propietarios</label>
      {mutation.isError && <div className="full"><ErrorState error={mutation.error} /></div>}
      <div className="form-actions full"><button type="button" className="button secondary" onClick={onDone}>Cancelar</button><button className="button" disabled={mutation.isPending}><Save size={17} />Guardar</button></div>
    </form></section>
}

export function Services() {
  const services = useClinicServices()
  const [editing, setEditing] = useState<Service | 'new' | null>(null)
  return <><PageHeader eyebrow="CATÁLOGO" title="Servicios" description="Los servicios retirados dejan de mostrarse, pero se conservan en citas anteriores." action={!editing && <button className="button" onClick={() => setEditing('new')}><Plus size={18} />Nuevo servicio</button>} />
    {editing && <ServiceForm key={editing === 'new' ? 'new' : editing.id} service={editing === 'new' ? undefined : editing} onDone={() => setEditing(null)} />}
    {services.isPending ? <Loading /> : services.isError ? <ErrorState error={services.error} retry={() => void services.refetch()} /> : !services.data.length ? <div className="panel"><EmptyState title="Sin servicios">Publica tu primer servicio para recibir solicitudes.</EmptyState></div>
      : <div className="panel table-wrap" tabIndex={0} role="region" aria-label="Servicios"><table className="data-table"><thead><tr><th>Servicio</th><th>Duración</th><th>Precio</th><th>Estado</th><th><span className="sr-only">Acciones</span></th></tr></thead><tbody>{services.data.map(s => <tr key={s.id}>
        <td><strong>{s.name}</strong><small>{s.description}</small></td><td>{s.duration_minutes} min</td><td>{money(s.price)}</td><td><Badge status={s.is_active ? 'Activa' : 'Inactivo'} /></td>
        <td className="actions"><button className="text-link" onClick={() => setEditing(s)}><Pencil size={15} /> Editar</button></td></tr>)}</tbody></table></div>}
  </>
}

/** Vista previa: «Así verán tus clientes el martes: 08:00, 08:30 … 19:30» (turnos de 30 min, servicio de 30 min). */
function SlotPreview({ opens, closes, days }: { opens?: string; closes?: string; days: number[] }) {
  const toMin = (t?: string) => /^\d{2}:\d{2}/.test(t ?? '') ? Number(t!.slice(0, 2)) * 60 + Number(t!.slice(3, 5)) : NaN
  const start = toMin(opens), end = toMin(closes)
  if (!days.length || !(end > start)) return null
  const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  const slots: string[] = []
  for (let m = start; m + 30 <= end; m += 30) slots.push(fmt(m))
  const day = dayName(days.includes(2) ? 2 : days[0])
  const text = slots.length > 4 ? `${slots.slice(0, 2).join(', ')} … ${slots[slots.length - 1]}` : slots.join(', ')
  return <p className="notice full" role="status">Así verán tus clientes el {day}: {text} ({slots.length} turnos de 30 min; los servicios largos terminan antes del cierre).</p>
}

const DEFAULT_HOURS = { opens_at: '09:00', closes_at: '18:00', open_days: [1, 2, 3, 4, 5, 6] }

export function ClinicSettings() {
  const clinic = useMyClinic()
  const client = useQueryClient()
  const [saved, setSaved] = useState(false)
  const values: ClinicValues | undefined = clinic.data && {
    name: clinic.data.name, address: clinic.data.address, phone: clinic.data.phone, opening_hours: clinic.data.opening_hours, description: clinic.data.description,
    opens_at: hhmm(clinic.data.opens_at, DEFAULT_HOURS.opens_at), closes_at: hhmm(clinic.data.closes_at, DEFAULT_HOURS.closes_at),
    open_days: clinic.data.open_days?.length ? clinic.data.open_days : DEFAULT_HOURS.open_days,
  }
  const { register, handleSubmit, watch, setValue, formState: { errors: e, isDirty }, reset } = useForm<ClinicValues>({ resolver: zodResolver(clinicSchema), values })
  const mutation = useMutation({ mutationFn: (v: ClinicValues) => api<ClinicValues>('/clinic', json('PUT', v)), onSuccess: async (_data, v) => { reset(v); setSaved(true); await client.invalidateQueries({ queryKey: ['clinic'] }); await client.invalidateQueries({ queryKey: ['me'] }) } })
  const days = watch('open_days') ?? []
  const toggleDay = (d: number) => setValue('open_days', days.includes(d) ? days.filter(x => x !== d) : [...days, d].sort((a, b) => a - b), { shouldDirty: true, shouldValidate: true })
  if (clinic.isPending) return <Loading />
  if (clinic.isError) return <ErrorState error={clinic.error} retry={() => void clinic.refetch()} />
  return <><PageHeader eyebrow="PERFIL PÚBLICO" title="Datos de la veterinaria" description="Así te ven los propietarios en el catálogo." />
    <section className="panel form-panel">{saved && <Notice>Datos actualizados.</Notice>}
      <form className="form-grid" noValidate onSubmit={handleSubmit(v => { setSaved(false); mutation.mutate(v) })}>
        <Field id="name" label="Nombre comercial" error={e.name?.message} full><input id="name" {...register('name')} /></Field>
        <Field id="address" label="Dirección" error={e.address?.message} full><input id="address" {...register('address')} /></Field>
        <Field id="phone" label="Teléfono" error={e.phone?.message}><input id="phone" type="tel" {...register('phone')} /></Field>
        <Field id="opening_hours" label="Horario (texto informativo)" hint="Se muestra en el catálogo. Los turnos se calculan con los campos de abajo." error={e.opening_hours?.message}><input id="opening_hours" {...register('opening_hours')} /></Field>
        <h3 className="sub full">Horario para turnos (hora de Lima)</h3>
        <Field id="opens_at" label="Abre a las" error={e.opens_at?.message}><input id="opens_at" type="time" step={1800} aria-invalid={!!e.opens_at} {...register('opens_at')} /></Field>
        <Field id="closes_at" label="Cierra a las" error={e.closes_at?.message}><input id="closes_at" type="time" step={1800} aria-invalid={!!e.closes_at} {...register('closes_at')} /></Field>
        <fieldset className="full slot-picker"><legend>Días de atención</legend><div className="days-picker">{[1, 2, 3, 4, 5, 6, 7].map(d => <label className="check" key={d}><input type="checkbox" checked={days.includes(d)} onChange={() => toggleDay(d)} />{dayName(d)[0].toUpperCase() + dayName(d).slice(1)}</label>)}</div>
          {e.open_days && <span className="field-error" role="alert">{e.open_days.message}</span>}</fieldset>
        <SlotPreview opens={watch('opens_at')} closes={watch('closes_at')} days={days} />
        <Field id="description" label="Descripción" error={e.description?.message} full><textarea id="description" rows={4} {...register('description')} /></Field>
        {mutation.isError && <div className="full"><ErrorState error={mutation.error} /></div>}
        <div className="form-actions full"><button className="button" disabled={mutation.isPending || !isDirty}><Save size={17} />Guardar cambios</button></div>
      </form></section></>
}

const CATEGORIES = ['Vacuna', 'Antiparasitario', 'Medicamento', 'Insumo'] as const

function InventoryForm({ item, onDone }: { item?: InventoryItem; onDone: (message: string) => void }) {
  const client = useQueryClient()
  const { register, handleSubmit, formState: { errors: e } } = useForm<InventoryItemValues>({ resolver: zodResolver(inventoryItemSchema), defaultValues: item ? { ...item, initial_stock: 0 } : { category: 'Vacuna', unit: 'unidad', min_stock: 0, initial_stock: 0 } })
  const mutation = useMutation({
    mutationFn: ({ initial_stock, ...v }: InventoryItemValues) => item
      ? api<InventoryItem>(`/clinic/inventory/${item.id}`, json('PUT', { ...v, is_active: item.is_active }))
      : api<InventoryItem>('/clinic/inventory', json('POST', { ...v, initial_stock })),
    onSuccess: async data => { await client.invalidateQueries({ queryKey: ['clinic', 'inventory'] }); onDone(item ? `${data?.name ?? item.name} actualizado.` : `${data?.name ?? 'Producto'} agregado al inventario.`) },
  })
  return <section className="panel form-panel" style={{ marginBottom: 24 }}><h2>{item ? `Editar ${item.name}` : 'Nuevo producto'}</h2>{item && <p className="muted">El stock solo cambia con ingresos, ajustes o usos en atención.</p>}
    <form className="form-grid" noValidate onSubmit={handleSubmit(v => mutation.mutate(v))} style={{ marginTop: 16 }}>
      <Field id="inv-name" label="Nombre del producto" error={e.name?.message} full><input id="inv-name" aria-invalid={!!e.name} {...register('name')} /></Field>
      <Field id="inv-category" label="Categoría" error={e.category?.message}><select id="inv-category" {...register('category')}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></Field>
      <Field id="inv-unit" label="Unidad" hint="Ej.: dosis, frasco, tableta." error={e.unit?.message}><input id="inv-unit" {...register('unit')} /></Field>
      <Field id="inv-min" label="Stock mínimo (alerta)" error={e.min_stock?.message}><input id="inv-min" type="number" min={0} step={1} {...register('min_stock')} /></Field>
      {!item && <Field id="inv-initial" label="Stock inicial" error={e.initial_stock?.message}><input id="inv-initial" type="number" min={0} step={1} {...register('initial_stock')} /></Field>}
      {mutation.isError && <div className="full"><ErrorState error={mutation.error} /></div>}
      <div className="form-actions full"><button type="button" className="button secondary" onClick={() => onDone('')}>Cancelar</button><button className="button" disabled={mutation.isPending}><Save size={17} />{mutation.isPending ? 'Guardando…' : 'Guardar'}</button></div>
    </form></section>
}

function MovementForm({ item, kind, onDone }: { item: InventoryItem; kind: 'Ingreso' | 'Ajuste'; onDone: (message: string) => void }) {
  const client = useQueryClient()
  const { register, handleSubmit, formState: { errors: e } } = useForm<MovementValues>({ resolver: zodResolver(movementSchema), defaultValues: { kind, notes: '' } })
  const mutation = useMutation({
    mutationFn: (v: MovementValues) => api<InventoryItem>(`/clinic/inventory/${item.id}/movements`, json('POST', { ...v, kind })),
    onSuccess: async data => { await client.invalidateQueries({ queryKey: ['clinic', 'inventory'] }); onDone(`${kind === 'Ingreso' ? 'Ingreso' : 'Ajuste'} registrado · ${item.name}: quedan ${data?.stock ?? '—'} ${item.unit}.`) },
  })
  return <section className="panel form-panel" style={{ marginBottom: 24 }}><h2>{kind === 'Ingreso' ? 'Registrar ingreso' : 'Ajustar stock'} · {item.name}</h2><p className="muted">Stock actual: {item.stock} {item.unit} · mínimo {item.min_stock}.</p>
    <form className="form-grid" noValidate onSubmit={handleSubmit(v => mutation.mutate(v))} style={{ marginTop: 16 }}>
      <Field id="mov-qty" label={kind === 'Ingreso' ? 'Cantidad que ingresa' : 'Cantidad (con signo)'} hint={kind === 'Ajuste' ? 'Ej.: -2 si se vencieron dos; 3 si el conteo encontró tres más.' : `En ${item.unit}.`} error={e.quantity?.message}><input id="mov-qty" type="number" step={1} min={kind === 'Ingreso' ? 1 : undefined} aria-invalid={!!e.quantity} {...register('quantity')} /></Field>
      <Field id="mov-notes" label={kind === 'Ingreso' ? 'Nota (opcional)' : 'Motivo'} hint={kind === 'Ingreso' ? 'Ej.: Factura 001-234.' : 'Obligatorio: conteo, merma, vencido…'} error={e.notes?.message}><input id="mov-notes" maxLength={500} aria-invalid={!!e.notes} {...register('notes')} /></Field>
      {mutation.isError && <div className="full"><ErrorState error={mutation.error} /></div>}
      <div className="form-actions full"><button type="button" className="button secondary" onClick={() => onDone('')}>Cancelar</button><button className="button" disabled={mutation.isPending}><Save size={17} />{mutation.isPending ? 'Guardando…' : kind === 'Ingreso' ? 'Registrar ingreso' : 'Guardar ajuste'}</button></div>
    </form></section>
}

function Movements({ item, onClose }: { item: InventoryItem; onClose: () => void }) {
  const movements = useMovements(item.id)
  return <section className="panel" style={{ marginTop: 24 }} aria-labelledby="movements-title"><div className="section-heading"><h2 id="movements-title" className="heading-icon"><HistoryIcon size={18} />Movimientos · {item.name}</h2><button className="text-link" onClick={onClose}>Cerrar</button></div>
    {movements.isPending ? <Loading /> : movements.isError ? <ErrorState error={movements.error} retry={() => void movements.refetch()} /> : !movements.data.length ? <EmptyState title="Sin movimientos">Los ingresos, ajustes y usos en atención aparecerán aquí.</EmptyState>
      : <div className="table-wrap" tabIndex={0} role="region" aria-label="Movimientos del producto"><table className="data-table"><thead><tr><th>Fecha</th><th>Tipo</th><th>Cantidad</th><th>Notas</th><th>Registró</th></tr></thead><tbody>{movements.data.map(m => <tr key={m.id}>
        <td>{dateTime(m.created_at)}</td><td>{m.kind}{m.care_event_id && <small>Atención #{m.care_event_id}</small>}</td><td><strong>{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</strong> {item.unit}</td><td>{m.notes || <span className="muted">—</span>}</td><td>{personName(m.user)}</td></tr>)}</tbody></table></div>}
  </section>
}

export function Inventory() {
  const inventory = useInventory()
  const client = useQueryClient()
  const [mode, setMode] = useState<{ kind: 'new' } | { kind: 'edit' | 'Ingreso' | 'Ajuste'; item: InventoryItem } | null>(null)
  const [history, setHistory] = useState<InventoryItem | null>(null)
  const [notice, setNotice] = useState('')
  const toggle = useMutation({
    mutationFn: (i: InventoryItem) => api<InventoryItem>(`/clinic/inventory/${i.id}`, json('PUT', { name: i.name, category: i.category, unit: i.unit, min_stock: i.min_stock, is_active: !i.is_active })),
    onSuccess: async data => { await client.invalidateQueries({ queryKey: ['clinic', 'inventory'] }); setNotice(data ? `${data.name} ${data.is_active ? 'reactivado' : 'desactivado'}.` : 'Cambios guardados.') },
  })
  const done = (message: string) => { setMode(null); setNotice(message) }
  const low = inventory.data?.filter(i => i.is_active && i.low_stock) ?? []
  // Orden por urgencia: sin stock, bajo mínimo, resto; inactivos al final.
  const urgency = (i: InventoryItem) => !i.is_active ? 3 : i.stock <= 0 ? 0 : i.low_stock ? 1 : 2
  const sorted = [...(inventory.data ?? [])].sort((x, y) => urgency(x) - urgency(y) || x.name.localeCompare(y.name))
  return <><PageHeader eyebrow="INSUMOS Y MEDICAMENTOS" title="Inventario" description="El stock baja solo al registrar una vacuna, desparasitación o tratamiento con su producto." action={!mode && <button className="button" onClick={() => { setNotice(''); setMode({ kind: 'new' }) }}><PackagePlus size={18} />Nuevo producto</button>} />
    {notice && <Notice>{notice}</Notice>}{toggle.isError && <ErrorState error={toggle.error} />}
    {low.length > 0 && <div className="notice warn" role="status"><TriangleAlert size={18} aria-hidden="true" /> {low.length === 1 ? `${low[0].name} tiene stock bajo.` : `${low.length} productos tienen stock bajo.`}</div>}
    {mode?.kind === 'new' && <InventoryForm onDone={done} />}
    {mode?.kind === 'edit' && <InventoryForm key={mode.item.id} item={mode.item} onDone={done} />}
    {(mode?.kind === 'Ingreso' || mode?.kind === 'Ajuste') && <MovementForm key={`${mode.kind}-${mode.item.id}`} item={mode.item} kind={mode.kind} onDone={done} />}
    {inventory.isPending ? <Loading /> : inventory.isError ? <ErrorState error={inventory.error} retry={() => void inventory.refetch()} /> : !inventory.data.length ? <div className="panel"><EmptyState title="Inventario vacío">Agrega vacunas, antiparasitarios, medicamentos o insumos para controlar su stock.</EmptyState></div>
      : <div className="panel table-wrap" tabIndex={0} role="region" aria-label="Inventario"><table className="data-table"><thead><tr><th>Producto</th><th>Categoría</th><th>Stock</th><th>Mínimo</th><th>Estado</th><th><span className="sr-only">Acciones</span></th></tr></thead><tbody>{sorted.map(i => <tr key={i.id} className={i.low_stock && i.is_active ? 'low-stock' : ''}>
        <td><strong>{i.name}</strong><small>{i.unit}</small></td><td>{i.category}</td><td><strong>{i.stock}</strong> {i.unit}</td><td>{i.min_stock}</td>
        <td>{!i.is_active ? <Badge status="Inactivo" /> : i.stock <= 0 ? <Badge status="Sin stock" /> : i.low_stock ? <Badge status="Stock bajo" /> : <Badge status="Con stock" />}</td>
        <td className="actions"><div className="inline-actions" style={{ justifyContent: 'flex-end' }}>
          <button className="button small" disabled={!i.is_active} onClick={() => { setNotice(''); setMode({ kind: 'Ingreso', item: i }) }}><PackagePlus size={15} />Registrar ingreso<span className="sr-only"> de {i.name}</span></button>
          <button className="button small secondary" disabled={!i.is_active} onClick={() => { setNotice(''); setMode({ kind: 'Ajuste', item: i }) }}><SlidersHorizontal size={15} />Ajustar<span className="sr-only"> {i.name}</span></button>
          <button className="text-link" onClick={() => setHistory(i)}>Historial<span className="sr-only"> de {i.name}</span></button>
          <button className="text-link" onClick={() => { setNotice(''); setMode({ kind: 'edit', item: i }) }}><Pencil size={15} />Editar<span className="sr-only"> {i.name}</span></button>
          <button className="text-link" disabled={toggle.isPending} onClick={() => { setNotice(''); toggle.mutate(i) }}>{i.is_active ? 'Desactivar' : 'Reactivar'}<span className="sr-only"> {i.name}</span></button>
        </div></td></tr>)}</tbody></table></div>}
    {history && <Movements key={history.id} item={history} onClose={() => setHistory(null)} />}
  </>
}

/** Normaliza un desglose del reporte, venga como objeto {clave: total} o como lista de filas. */
function breakdownRows(b: IncomeBreakdown | undefined, keys: string[]) {
  if (!b) return []
  if (Array.isArray(b)) return b.map(r => ({ label: String(keys.map(k => r[k]).find(v => v !== undefined && v !== null) ?? '—'), total: Number(r.total ?? r.amount ?? 0), count: r.count === undefined ? undefined : Number(r.count) }))
  return Object.entries(b).map(([label, v]) => typeof v === 'number' ? { label, total: v, count: undefined } : { label, total: Number(v?.total ?? 0), count: v?.count })
}
function pendingOf(p: IncomeReportData['pending']) {
  if (typeof p === 'number') return { total: p, count: undefined }
  return { total: Number(p?.total ?? p?.amount ?? 0), count: p?.count }
}

function BreakdownTable({ title, rows, labelHeader, formatLabel = (l: string) => l }: { title: string; rows: { label: string; total: number; count?: number }[]; labelHeader: string; formatLabel?: (l: string) => string }) {
  return <section className="panel"><div className="section-heading"><h2>{title}</h2></div>
    {!rows.length ? <p className="wait-empty">Sin cobros en el periodo.</p> : <div className="table-wrap" tabIndex={0} role="region" aria-label="Cobros del periodo"><table className="data-table"><thead><tr><th>{labelHeader}</th><th>Cobros</th><th>Total</th></tr></thead>
      <tbody>{rows.map(r => <tr key={r.label}><td>{formatLabel(r.label)}</td><td>{r.count ?? '—'}</td><td><strong>{money(r.total)}</strong></td></tr>)}</tbody></table></div>}
  </section>
}

/** Barras por día (sin tortas); el total va en texto y la tabla equivalente está debajo. */
function DayBars({ rows }: { rows: { label: string; total: number }[] }) {
  const max = Math.max(...rows.map(r => r.total), 0)
  if (!rows.length || !max) return null
  return <section className="panel" style={{ marginBottom: 16 }} aria-labelledby="bars-title"><div className="section-heading"><h2 id="bars-title">Ingresos por día</h2><span className="muted">La tabla «Por día» tiene los mismos datos</span></div>
    <ol className="bars" aria-hidden="true">{rows.map(r => <li key={r.label} title={`${longDate(r.label)}: ${money(r.total)}`}><span>{r.total ? Math.round(r.total) : ''}</span><span className="bar-fill" style={{ height: `${Math.max(2, (r.total / max) * 140)}px` }} /><span>{r.label.slice(8, 10)}</span></li>)}</ol></section>
}

const PERIODS = [['hoy', 'Hoy', 0], ['7', '7 días', 6], ['30', '30 días', 29]] as const

export function IncomeReport() {
  const today = todayLima()
  const [params, setParams] = useSearchParams()
  const dateOk = (v: string | null) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v)
  const range = { date_from: dateOk(params.get('desde')) ? params.get('desde')! : addDays(today, -29), date_to: dateOk(params.get('hasta')) ? params.get('hasta')! : today }
  const setRange = (date_from: string, date_to: string) => setParams({ desde: date_from, hasta: date_to }, { replace: true })
  const report = useIncomeReport(range.date_from, range.date_to)
  const inventory = useInventory()
  const invalid = range.date_from > range.date_to
  const pending = report.data ? pendingOf(report.data.pending) : null
  const appts = report.data?.appointments
  const apptTotal = appts ? Object.values(appts).reduce<number>((a, b) => a + (b ?? 0), 0) : 0
  const noShow = appts?.['No asistió'] ?? 0
  const ticket = report.data ? Number(report.data.average_ticket ?? (report.data.count ? report.data.total / report.data.count : 0)) : 0
  const lowStock = inventory.data?.filter(i => i.is_active && i.low_stock).length
  const days = report.data ? breakdownRows(report.data.by_day, ['key', 'date', 'day', 'label']).sort((a, b) => a.label.localeCompare(b.label)) : []
  const byAmount = (rows: { label: string; total: number; count?: number }[]) => [...rows].sort((a, b) => b.total - a.total)
  const active = PERIODS.find(([, , back]) => range.date_to === today && range.date_from === addDays(today, -back))?.[0] ?? 'rango'
  const stat = (Icon: typeof Wallet, tone: string, label: string, value: string, to?: string) => {
    const body = <><span className={`stat-icon ${tone}`}><Icon aria-hidden="true" /></span><div><span>{label}</span><strong>{value}</strong></div>{to && <ArrowRight size={20} aria-hidden="true" />}</>
    return to ? <Link className="stat-card" to={to}>{body}</Link> : <article className="stat-card">{body}</article>
  }
  return <><PageHeader eyebrow="RESUMEN DEL NEGOCIO" title="Reporte de ingresos" description="Cobros vigentes (sin anulados) del periodo, en soles. El periodo queda en la dirección para compartirlo." />
    <div className="toolbar">
      <div className="period-chips filter-tabs" role="group" aria-label="Periodo" style={{ marginBottom: 0 }}>{PERIODS.map(([key, label, back]) => <button key={key} aria-pressed={active === key} className={active === key ? 'selected' : ''} onClick={() => setRange(addDays(today, -back), today)}>{label}</button>)}<button aria-pressed={active === 'rango'} className={active === 'rango' ? 'selected' : ''} onClick={() => document.getElementById('income-from')?.focus()}>Rango</button></div>
      <Field id="income-from" label="Desde"><input id="income-from" type="date" max={today} value={range.date_from} onChange={e => e.target.value && setRange(e.target.value, range.date_to)} /></Field>
      <Field id="income-to" label="Hasta"><input id="income-to" type="date" max={today} value={range.date_to} onChange={e => e.target.value && setRange(range.date_from, e.target.value)} /></Field>
    </div>
    {invalid ? <ErrorState error={new Error('La fecha inicial debe ser anterior o igual a la final.')} /> : report.isPending ? <Loading label="Calculando ingresos…" /> : report.isError ? <ErrorState error={report.error} retry={() => void report.refetch()} /> : <>
      <div className="stats-grid five">
        {stat(ChartColumn, 'teal', `Ingresos · ${report.data.count} cobros`, money(Number(report.data.total)), '/clinica/caja')}
        {stat(Receipt, 'teal', 'Ticket promedio', money(ticket))}
        {stat(Wallet, 'amber', `Por cobrar${pending?.count !== undefined ? ` · ${pending.count} atenciones` : ''}`, money(pending?.total ?? 0), '/clinica/caja')}
        {stat(UserX, 'amber', apptTotal ? `Inasistencias · ${noShow} de ${apptTotal} citas` : 'Inasistencias', apptTotal ? `${Math.round(noShow / apptTotal * 100)} %` : '—', '/clinica/agenda?estado=No%20asisti%C3%B3')}
        {stat(Package, lowStock ? 'amber' : 'teal', 'Productos bajo mínimo', lowStock === undefined ? '—' : String(lowStock), '/clinica/inventario')}
      </div>
      <p className="muted" style={{ marginBottom: 14 }}>Periodo: {relativeDate(range.date_from)} – {relativeDate(range.date_to)}. La ocupación de la agenda llegará en una versión posterior.</p>
      <DayBars rows={days} />
      <div className="report-grid">
        <BreakdownTable title="Por método" labelHeader="Método" rows={byAmount(breakdownRows(report.data.by_method, ['key', 'method', 'label', 'name']))} />
        <BreakdownTable title="Por día" labelHeader="Día" rows={days} formatLabel={l => /^\d{4}-\d{2}-\d{2}/.test(l) ? longDate(l) : l} />
        <BreakdownTable title="Por servicio" labelHeader="Servicio" rows={byAmount(breakdownRows(report.data.by_service, ['key', 'service_name', 'service', 'name', 'label']))} />
      </div>
    </>}
  </>
}
