import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Building2, CalendarDays, ChartColumn, ChevronRight, ClipboardList, Heart, LayoutDashboard, LogOut, Menu, Package, PawPrint, Settings, Stethoscope, Tags, UserRound, Users, Wallet, X, type LucideIcon } from 'lucide-react'
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { api, ApiError, json } from '../lib/api'
import { roleLabel } from '../lib/format'
import { useMe } from '../lib/queries'
import { allowed, areaOf, can, homeFor, type Area } from '../lib/roles'
import type { User } from '../lib/types'
import { ForcedPasswordChange } from '../pages/Account'
import { A11yMenu } from './A11yMenu'
import { Brand, ErrorState, Loading } from './ui'

interface NavItem { to: string; label: string; Icon: LucideIcon; end?: boolean }
function linksFor(user: User): NavItem[] {
  const area = areaOf(user)
  if (area === 'owner') return [
    { to: '/app', label: 'Mi inicio', Icon: LayoutDashboard, end: true },
    { to: '/app/mascotas', label: 'Mis mascotas', Icon: PawPrint },
    { to: '/app/citas', label: 'Mis citas', Icon: CalendarDays },
    { to: '/app/veterinarias', label: 'Veterinarias', Icon: Stethoscope },
    { to: '/app/perfil', label: 'Mi perfil', Icon: UserRound },
  ]
  if (area === 'admin') return [
    { to: '/admin', label: 'Resumen', Icon: LayoutDashboard, end: true },
    { to: '/admin/clinicas', label: 'Veterinarias', Icon: Building2 },
    { to: '/admin/perfil', label: 'Mi perfil', Icon: UserRound },
  ]
  return [
    { to: '/clinica', label: 'Hoy', Icon: LayoutDashboard, end: true },
    { to: '/clinica/agenda', label: 'Agenda', Icon: CalendarDays },
    { to: '/clinica/pacientes', label: 'Pacientes', Icon: ClipboardList },
    ...(allowed(user, 'cashier') ? [{ to: '/clinica/caja', label: 'Caja', Icon: Wallet }] : []),
    ...(allowed(user, 'inventory') ? [{ to: '/clinica/inventario', label: 'Inventario', Icon: Package }] : []),
    ...(allowed(user, 'income') ? [{ to: '/clinica/ingresos', label: 'Ingresos', Icon: ChartColumn }] : []),
    ...(can(user, 'admin') ? [
      { to: '/clinica/equipo', label: 'Equipo', Icon: Users },
      { to: '/clinica/servicios', label: 'Servicios', Icon: Tags },
      { to: '/clinica/datos', label: 'Datos de la veterinaria', Icon: Settings },
    ] : []),
    { to: '/clinica/perfil', label: 'Mi perfil', Icon: UserRound },
  ]
}
const captions: Record<Area, string> = { owner: 'ESPACIO DEL PROPIETARIO', clinic: 'ESPACIO DE LA VETERINARIA', admin: 'ADMINISTRACIÓN VETGEST' }

export function Layout({ area }: { area: Area }) {
  const me = useMe()
  const [menu, setMenu] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const client = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return }
    // Al cambiar de pantalla, el foco va al título nuevo para que el lector de pantalla lo anuncie (WCAG 2.4.3).
    let frames = 0, id = 0
    // Las pantallas diferidas tardan unos cuadros en mostrar su título: se reintenta hasta ~1 s.
    const tryFocus = () => {
      const h1 = document.querySelector<HTMLElement>('#main h1')
      if (h1) h1.focus({ preventScroll: true })
      else if (frames++ < 60) id = requestAnimationFrame(tryFocus)
    }
    id = requestAnimationFrame(tryFocus)
    return () => cancelAnimationFrame(id)
  }, [location.pathname])
  if (me.isPending) return <Loading label="Verificando tu sesión…" />
  if (me.isError) return <div className="standalone"><ErrorState error={me.error} retry={() => void me.refetch()} /></div>
  if (!me.data) return <Navigate to="/iniciar-sesion" state={{ from: location.pathname + location.search }} replace />
  const user = me.data
  if (areaOf(user) !== area) return <Navigate to={homeFor(user)} replace />
  const links = linksFor(user)
  const role = user.membership ? roleLabel[user.membership.role] : roleLabel[user.role as 'owner' | 'platform_admin']
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
      <p className="sidebar-caption">{captions[area]}</p>{user.membership && <p className="sidebar-clinic">{user.membership.clinic_name}</p>}
      <nav aria-label="Navegación principal">{links.map(({ to, label, Icon, end }) => <NavLink key={to} to={to} end={end} onClick={() => setMenu(false)} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Icon size={20} /><span>{label}</span></NavLink>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-note"><Heart size={21} /><p>Una vida juntos.<br /><strong>Un cuidado a la vez.</strong></p></div><button className="logout" onClick={() => void logout()} disabled={loggingOut}><LogOut size={19} />{loggingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}</button></div>
    </aside>
    {menu && <button className="menu-overlay" aria-label="Cerrar menú" onClick={() => setMenu(false)} />}
    <div className="app-body"><header className="topbar"><div className="topbar-left"><button className="icon-button mobile-only" aria-label="Abrir menú" aria-expanded={menu} onClick={() => setMenu(true)}><Menu /></button><span className="breadcrumb">{area === 'owner' ? 'Mi espacio' : area === 'clinic' ? 'Veterinaria' : 'VetGest'} <ChevronRight size={14} /><strong>{[...links].reverse().find(l => location.pathname.startsWith(l.to))?.label}</strong></span></div><div className="topbar-right"><A11yMenu /><NavLink to={`${homeFor(user)}/perfil`} className="account" aria-label={`Mi perfil: ${user.profile.first_name}, ${role}`}><span className="account-name" aria-hidden="true">{user.profile.first_name}<small>{role}</small></span><span className="avatar" aria-hidden="true">{user.profile.first_name[0]}{user.profile.last_name[0]}</span></NavLink></div></header>
      <main id="main" className="main-content" key={location.pathname}>{error && <ErrorState error={error} />}{user.must_change_password ? <ForcedPasswordChange /> : <Outlet />}</main>
      <footer className="app-footer"><span>VetGest · Siempre a su lado</span><span>Hecho para cuidar mejor.</span></footer>
    </div>
  </div>
}
