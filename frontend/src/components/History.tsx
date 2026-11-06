import { Stethoscope, Syringe } from 'lucide-react'
import { dateTime, fullName, longDate } from '../lib/format'
import type { History } from '../lib/types'
import { EmptyState, ErrorState, Loading } from './ui'

type Query = { isPending: boolean; isError: boolean; error: Error | null; data?: History; refetch: () => unknown }

export function HistoryView({ history, petName }: { history: Query; petName: string }) {
  if (history.isPending) return <Loading label="Cargando historial…" />
  if (history.isError || !history.data) return <ErrorState error={history.error} retry={() => void history.refetch()} />
  const { records, care } = history.data
  return <div className="dashboard-columns">
    <section className="panel"><div className="section-heading"><h2>Atenciones</h2><span className="muted">{records.length}</span></div>
      {records.length ? <div className="timeline">{records.map(r => <article className="timeline-item" key={r.id}>
        <p className="meta">{dateTime(r.attended_at)} · {r.clinic.name} · Dr(a). {fullName(r.vet.profile)}</p>
        <h3>{r.reason}</h3><p><strong>Diagnóstico:</strong> {r.diagnosis}</p>
        {r.indications && <p><strong>Indicaciones:</strong> {r.indications}</p>}
        {(r.weight || r.next_visit_on) && <p className="meta">{r.weight ? `Peso: ${r.weight} kg` : ''}{r.weight && r.next_visit_on ? ' · ' : ''}{r.next_visit_on ? `Próximo control: ${longDate(r.next_visit_on)}` : ''}</p>}
      </article>)}</div> : <EmptyState title="Sin atenciones registradas">Cuando una veterinaria atienda a {petName}, verás aquí el diagnóstico y las indicaciones.</EmptyState>}
    </section>
    <section className="panel"><div className="section-heading"><h2>Vacunas y tratamientos</h2><span className="muted">{care.length}</span></div>
      {care.length ? <div className="reminder-list">{care.map(c => <div className="reminder-row" key={c.id}>
        <span className="stat-icon teal">{c.kind === 'Tratamiento' ? <Stethoscope size={20} /> : <Syringe size={20} />}</span>
        <div><strong>{c.kind}: {c.name}{c.dose ? ` · ${c.dose}` : ''}</strong><small>{longDate(c.applied_on)} · {c.clinic.name}</small>{c.notes && <small>{c.notes}</small>}</div>
        {c.next_due_on && <span className="badge confirmed">Próxima: {longDate(c.next_due_on)}</span>}
      </div>)}</div> : <EmptyState title="Sin vacunas ni tratamientos">Aquí aparecerá la cartilla de {petName}.</EmptyState>}
    </section>
  </div>
}
