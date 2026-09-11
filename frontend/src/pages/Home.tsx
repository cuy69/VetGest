import { ArrowRight, CalendarDays, Check, Heart, PawPrint, Stethoscope } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Brand, petPhoto } from '../components/ui'

export function Home() {
  return <div className="public-page"><header className="public-header"><Brand /><nav aria-label="Cuenta"><Link to="/iniciar-sesion" className="text-link">Iniciar sesión</Link><Link to="/registro" className="button small">Crear cuenta <ArrowRight size={16} /></Link></nav></header>
    <main><section className="landing-hero"><div className="landing-copy"><p className="eyebrow"><Heart size={16} /> SU BIENESTAR EMPIEZA CONTIGO</p><h1>Más tiempo juntos.<br /><em>Menos pendientes.</em></h1><p className="hero-description">Toda la información de tus mascotas, sus veterinarias y sus próximas citas. En un solo lugar, siempre a tu lado.</p><Link className="button large" to="/registro">Comienza a cuidar mejor <ArrowRight size={19} /></Link><p className="hero-footnote"><Check size={16} /> Crea tu cuenta y registra a tu primer compañero.</p></div><div className="landing-visual"><img src={petPhoto} alt="Un perro y un gato descansan juntos al aire libre" fetchPriority="high" /><div className="photo-caption"><span className="caption-icon"><PawPrint /></span><div><strong>Ellos son parte de tu familia.</strong><span>Su cuidado también merece un lugar.</span></div></div></div></section>
      <section className="landing-features" aria-label="Lo que puedes hacer en VetGest">{[
        { Icon: PawPrint, title: 'Cada mascota, su espacio', text: 'Guarda sus datos y mantenlos actualizados, desde su edad hasta su peso.' },
        { Icon: Stethoscope, title: 'Encuentra su veterinaria', text: 'Consulta servicios, horarios y precios referenciales para elegir su atención.' },
        { Icon: CalendarDays, title: 'Organiza su próxima cita', text: 'Envía una solicitud y consulta o cancela tus citas desde tu cuenta.' },
      ].map(({ Icon, title, text }, i) => <article key={title}><span className="feature-number">0{i + 1}</span><Icon size={25} /><h2>{title}</h2><p>{text}</p></article>)}</section>
    </main><footer className="public-footer"><Brand /><span>Siempre a su lado.</span></footer></div>
}
