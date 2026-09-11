import { useState } from 'react'
import { ArrowRight, Clock3, MapPin, Phone, Search, Stethoscope } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { Back, EmptyState, ErrorState, Loading, PageHeader } from '../components/ui'
import { money } from '../lib/format'
import { useClinic, useClinics, useServices } from '../lib/queries'

export function ClinicList() {
  const [search, setSearch] = useState('')
  const clinics = useClinics(search)
  return <><PageHeader eyebrow="EL SIGUIENTE PASO EN SU CUIDADO" title="Encuentra su veterinaria" description="Conoce las opciones de atención y elige la más adecuada para tu mascota." /><div className="catalog-toolbar"><div className="search-input"><Search size={20} /><label className="sr-only" htmlFor="clinic-search">Buscar veterinaria por nombre</label><input id="clinic-search" type="search" placeholder="Buscar veterinaria por nombre…" maxLength={120} value={search} onChange={e => setSearch(e.target.value)} /></div><span className="demo-label">Catálogo de demostración · Lima</span></div>
    {clinics.isPending ? <Loading label="Buscando veterinarias…" /> : clinics.isError ? <ErrorState error={clinics.error} retry={() => void clinics.refetch()} /> : !clinics.data.length ? <div className="panel"><EmptyState title="No encontramos coincidencias" action={<button className="button secondary small" onClick={() => setSearch('')}>Limpiar búsqueda</button>}>Prueba con otro nombre de veterinaria.</EmptyState></div> : <div className="clinic-grid">{clinics.data.map((c, i) => <article className="panel clinic-card" key={c.id}><div className={`clinic-symbol color-${i % 3}`}><Stethoscope size={35} strokeWidth={1.7} /><span>ATENCIÓN VETERINARIA</span></div><div className="clinic-card-content"><h2>{c.name}</h2><p>{c.description}</p><ul className="contact-list"><li><MapPin size={17} /><span>{c.address}</span></li><li><Clock3 size={17} /><span>{c.opening_hours}</span></li><li><Phone size={17} /><span>{c.phone}</span></li></ul><Link to={`/app/veterinarias/${c.id}`} className="card-link">Ver servicios <ArrowRight size={18} /></Link></div></article>)}</div>}
    <p className="catalog-disclaimer">Las veterinarias, direcciones, teléfonos y precios son datos ficticios para explorar VetGest. No representan establecimientos reales.</p>
  </>
}
export function ClinicDetail() {
  const { id } = useParams()
  const clinic = useClinic(id)
  const services = useServices(id)
  if (clinic.isPending || services.isPending) return <Loading />
  if (clinic.isError || services.isError) return <ErrorState error={clinic.error ?? services.error} retry={() => { void clinic.refetch(); void services.refetch() }} />
  const c = clinic.data
  return <><Back to="/app/veterinarias">Todas las veterinarias</Back><PageHeader title={c.name} description={c.description} /><div className="clinic-info panel"><span><MapPin size={19} />{c.address}</span><span><Clock3 size={19} />{c.opening_hours}</span><span><Phone size={19} />{c.phone}</span></div><div className="section-heading service-heading"><h2>Servicios disponibles</h2><span className="muted">Precios referenciales en soles</span></div>{services.data.length ? <div className="services-grid">{services.data.map(s => <article className="panel service-card" key={s.id}><span className="stat-icon teal"><Stethoscope /></span><h3>{s.name}</h3><p>{s.description}</p><div className="service-meta"><span><Clock3 size={16} />{s.duration_minutes} min</span><strong>{money(s.price)}</strong></div><Link className="button secondary" to={`/app/citas/nueva?clinic=${c.id}&service=${s.id}`}>Solicitar cita <ArrowRight size={17} /></Link></article>)}</div> : <EmptyState title="Aún no hay servicios">Esta veterinaria todavía no tiene servicios publicados.</EmptyState>}<p className="catalog-disclaimer">Catálogo ficticio de demostración. Una solicitud queda pendiente; no equivale a una reserva confirmada.</p></>
}
