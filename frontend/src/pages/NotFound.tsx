import { ArrowLeft, PawPrint } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Brand } from '../components/ui'

export function NotFound() {
  return <div className="not-found"><Brand /><main><span className="empty-icon"><PawPrint size={42} /></span><p className="eyebrow">ERROR 404</p><h1>Esta huella no lleva a ninguna parte.</h1><p className="muted">La página que buscas no existe o cambió de dirección.</p><Link to="/" className="button"><ArrowLeft size={18} />Volver al inicio</Link></main></div>
}
