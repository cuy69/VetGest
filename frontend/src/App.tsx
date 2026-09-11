import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Route, Routes, useLocation } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Home } from './pages/Home'
import { Login, Register } from './pages/Auth'
import { Dashboard } from './pages/Dashboard'
import { Profile } from './pages/Profile'
import { PetDetail, PetForm, PetList } from './pages/Pets'
import { ClinicDetail, ClinicList } from './pages/Clinics'
import { AppointmentDetail, AppointmentForm, AppointmentList } from './pages/Appointments'
import { NotFound } from './pages/NotFound'

export default function App() {
  const client = useQueryClient()
  const location = useLocation()
  useEffect(() => {
    const expired = () => { client.clear(); client.setQueryData(['me'], null) }
    window.addEventListener('vetgest:session-expired', expired)
    return () => window.removeEventListener('vetgest:session-expired', expired)
  }, [client])
  useEffect(() => { window.scrollTo(0, 0) }, [location.pathname])
  return <Routes><Route path="/" element={<Home />} /><Route path="/registro" element={<Register />} /><Route path="/iniciar-sesion" element={<Login />} /><Route path="/app" element={<Layout />}>
    <Route index element={<Dashboard />} /><Route path="perfil" element={<Profile />} />
    <Route path="mascotas" element={<PetList />} /><Route path="mascotas/nueva" element={<PetForm />} /><Route path="mascotas/:id" element={<PetDetail />} /><Route path="mascotas/:id/editar" element={<PetForm />} />
    <Route path="veterinarias" element={<ClinicList />} /><Route path="veterinarias/:id" element={<ClinicDetail />} />
    <Route path="citas" element={<AppointmentList />} /><Route path="citas/nueva" element={<AppointmentForm />} /><Route path="citas/:id" element={<AppointmentDetail />} />
  </Route><Route path="*" element={<NotFound />} /></Routes>
}
