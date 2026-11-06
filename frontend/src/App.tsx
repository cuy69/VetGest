import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Home } from './pages/Home'
import { Login, Register } from './pages/Auth'
import { Dashboard } from './pages/Dashboard'
import { Profile } from './pages/Profile'
import { PetDetail, PetForm, PetList } from './pages/Pets'
import { ClinicDetail, ClinicList } from './pages/Clinics'
import { AppointmentDetail, AppointmentForm, AppointmentList } from './pages/Appointments'
import { NotFound } from './pages/NotFound'
import { Agenda, ClinicAppointmentDetail, ClinicHome } from './pages/Clinic'
import { PatientDetail, Patients } from './pages/ClinicPatients'
import { AdminClinics, AdminHome } from './pages/Admin'
import { Loading } from './components/ui'
import { useMe } from './lib/queries'
import { allowed, can, type Permission } from './lib/roles'

// Páginas de administración y caja: se cargan aparte para no engordar el paquete inicial.
const adminPage = (name: 'ClinicSettings' | 'IncomeReport' | 'Inventory' | 'Services' | 'Team') => lazy(() => import('./pages/ClinicAdmin').then(m => ({ default: m[name] })))
const ClinicSettings = adminPage('ClinicSettings')
const IncomeReport = adminPage('IncomeReport')
const Inventory = adminPage('Inventory')
const Services = adminPage('Services')
const Team = adminPage('Team')
const Cashier = lazy(() => import('./pages/ClinicCashier').then(m => ({ default: m.Cashier })))
const Page = ({ children }: { children: ReactNode }) => <Suspense fallback={<Loading />}>{children}</Suspense>

function ClinicAdminOnly({ children }: { children: React.ReactNode }) {
  const me = useMe()
  return can(me.data, 'admin') ? children : <Navigate to="/clinica" replace />
}
function ClinicAllowed({ permission, children }: { permission: Permission; children: React.ReactNode }) {
  const me = useMe()
  return allowed(me.data, permission) ? children : <Navigate to="/clinica" replace />
}

export default function App() {
  const client = useQueryClient()
  const location = useLocation()
  useEffect(() => {
    const expired = () => { client.clear(); client.setQueryData(['me'], null) }
    window.addEventListener('vetgest:session-expired', expired)
    return () => window.removeEventListener('vetgest:session-expired', expired)
  }, [client])
  useEffect(() => { window.scrollTo(0, 0) }, [location.pathname])
  return <Routes><Route path="/" element={<Home />} /><Route path="/registro" element={<Register />} /><Route path="/iniciar-sesion" element={<Login />} /><Route path="/app" element={<Layout area="owner" />}>
    <Route index element={<Dashboard />} /><Route path="perfil" element={<Profile />} />
    <Route path="mascotas" element={<PetList />} /><Route path="mascotas/nueva" element={<PetForm />} /><Route path="mascotas/:id" element={<PetDetail />} /><Route path="mascotas/:id/editar" element={<PetForm />} />
    <Route path="veterinarias" element={<ClinicList />} /><Route path="veterinarias/:id" element={<ClinicDetail />} />
    <Route path="citas" element={<AppointmentList />} /><Route path="citas/nueva" element={<AppointmentForm />} /><Route path="citas/:id" element={<AppointmentDetail />} />
  </Route><Route path="/clinica" element={<Layout area="clinic" />}>
    <Route index element={<ClinicHome />} /><Route path="agenda" element={<Agenda />} /><Route path="agenda/:id" element={<ClinicAppointmentDetail />} />
    <Route path="pacientes" element={<Patients />} /><Route path="pacientes/:id" element={<PatientDetail />} /><Route path="perfil" element={<Profile />} />
    <Route path="equipo" element={<ClinicAdminOnly><Page><Team /></Page></ClinicAdminOnly>} /><Route path="servicios" element={<ClinicAdminOnly><Page><Services /></Page></ClinicAdminOnly>} /><Route path="datos" element={<ClinicAdminOnly><Page><ClinicSettings /></Page></ClinicAdminOnly>} />
    <Route path="caja" element={<ClinicAllowed permission="cashier"><Page><Cashier /></Page></ClinicAllowed>} /><Route path="inventario" element={<ClinicAllowed permission="inventory"><Page><Inventory /></Page></ClinicAllowed>} /><Route path="ingresos" element={<ClinicAllowed permission="income"><Page><IncomeReport /></Page></ClinicAllowed>} />
  </Route><Route path="/admin" element={<Layout area="admin" />}>
    <Route index element={<AdminHome />} /><Route path="clinicas" element={<AdminClinics />} /><Route path="perfil" element={<Profile />} />
  </Route><Route path="*" element={<NotFound />} /></Routes>
}
