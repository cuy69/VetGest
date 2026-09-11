import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CalendarDays, ChevronRight, Heart, LayoutDashboard, LogOut, Menu, PawPrint, Stethoscope, UserRound, X } from 'lucide-react'
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { api, ApiError, json } from '../lib/api'
import { useMe } from '../lib/queries'
import { Brand, ErrorState, Loading } from './ui'

const links = [
  { to: '/app', label: 'Mi inicio', Icon: LayoutDashboard, end: true },
  { to: '/app/mascotas', label: 'Mis mascotas', Icon: PawPrint },
  { to: '/app/citas', label: 'Mis citas', Icon: CalendarDays },
  { to: '/app/veterinarias', label: 'Veterinarias', Icon: Stethoscope },
  { to: '/app/perfil', label: 'Mi perfil', Icon: UserRound },
]

export function Layout() {
  const me = useMe()
  const [menu, setMenu] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const client = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  if (me.isPending) return <Loading label="Verificando tu sesión…" />
  if (me.isError) return <div className="standalone"><ErrorState error={me.error} retry={() => void me.refetch()} /></div>
  if (!me.data) return <Navigate to="/iniciar-sesion" state={{ from: location.pathname + location.search }} replace />
  const user = me.data
  async function logout() {
    setLoggingOut(true); setError(null)
    try {
      await api('/auth/logout', json('POST'))
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401)) { setError(e as Error); setLoggingOut(false); return }
    }
    client.clear(); client.setQueryData(['me'], null)
    navigate('/iniciar-sesion', { replace: true })
  }
  return <div className="app-shell">
    <a className="skip-link" href="#main">Saltar al contenido</a>
    <aside className={`sidebar ${menu ? 'open' : ''}`}>
      <div className="sidebar-brand"><Brand /><button className="icon-button mobile-only" aria-label="Cerrar menú" onClick={() => setMenu(false)}><X /></button></div>
      <p className="sidebar-caption">ESPACIO DEL PROPIETARIO</p>
      <nav aria-label="Navegación principal">{links.map(({ to, label, Icon, end }) => <NavLink key={to} to={to} end={end} onClick={() => setMenu(false)} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Icon size={20} /><span>{label}</span></NavLink>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-note"><Heart size={21} /><p>Una vida juntos.<br /><strong>Un cuidado a la vez.</strong></p></div><button className="logout" onClick={() => void logout()} disabled={loggingOut}><LogOut size={19} />{loggingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}</button></div>
    </aside>
    {menu && <button className="menu-overlay" aria-label="Cerrar menú" onClick={() => setMenu(false)} />}
    <div className="app-body"><header className="topbar"><div className="topbar-left"><button className="icon-button mobile-only" aria-label="Abrir menú" aria-expanded={menu} onClick={() => setMenu(true)}><Menu /></button><span className="breadcrumb">Mi espacio <ChevronRight size={14} /><strong>{[...links].reverse().find(l => location.pathname.startsWith(l.to))?.label}</strong></span></div><NavLink to="/app/perfil" className="account"><span className="account-name">{user.profile.first_name}<small>Propietario</small></span><span className="avatar">{user.profile.first_name[0]}{user.profile.last_name[0]}</span></NavLink></header>
      <main id="main" className="main-content" key={location.pathname}>{error && <ErrorState error={error} />}<Outlet /></main>
      <footer className="app-footer"><span>VetGest · Siempre a su lado</span><span>Hecho para cuidar mejor.</span></footer>
    </div>
  </div>
}
