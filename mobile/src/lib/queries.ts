import { useCallback, useEffect, useRef, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { api } from './api'
import type { Appointment, Availability, Clinic, History, Pet, Reminder, Service } from './types'

/** Estado en vivo de las citas: la app consulta cada 30 s (docs/api.md, «Sala de espera»). */
export const LIVE_INTERVAL = 30_000

export const usePets = () => useQuery({ queryKey: ['pets'], queryFn: () => api<Pet[]>('/pets') })
export const usePet = (id: string | undefined) => useQuery({ queryKey: ['pets', id], queryFn: () => api<Pet>(`/pets/${id}`), enabled: !!id })
export const usePetHistory = (id: string | undefined) => useQuery({ queryKey: ['pets', id, 'history'], queryFn: () => api<History>(`/pets/${id}/history`), enabled: !!id })
export const useClinics = (search = '') => useQuery({ queryKey: ['clinics', search], queryFn: () => api<Clinic[]>(`/clinics?search=${encodeURIComponent(search)}`) })
export const useClinic = (id: string | number | undefined) => useQuery({ queryKey: ['clinics', 'detail', String(id)], queryFn: () => api<Clinic>(`/clinics/${id}`), enabled: !!id })
export const useServices = (clinicId: string | number | undefined) => useQuery({ queryKey: ['services', String(clinicId)], queryFn: () => api<Service[]>(`/services?clinic_id=${clinicId}`), enabled: !!clinicId })
export const useAppointments = (live = false) => useQuery({ queryKey: ['appointments'], queryFn: () => api<Appointment[]>('/appointments'), refetchInterval: live ? LIVE_INTERVAL : false })
export const useAppointment = (id: string | undefined) => useQuery({ queryKey: ['appointments', id], queryFn: () => api<Appointment>(`/appointments/${id}`), enabled: !!id, refetchInterval: LIVE_INTERVAL })
export const useReminders = () => useQuery({ queryKey: ['reminders'], queryFn: () => api<Reminder[]>('/reminders') })
export const useAvailability = (clinicId: number, serviceId: number, date: string) => useQuery({
  queryKey: ['availability', clinicId, serviceId, date],
  queryFn: () => api<Availability>(`/clinics/${clinicId}/availability?service_id=${serviceId}&date=${date}`),
  enabled: clinicId > 0 && serviceId > 0 && !!date,
})

/** Reloj que avanza cada `ms` (para «Actualizado hace X min»). */
export function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t) }, [ms])
  return now
}

/** Vuelve a consultar al regresar a la pantalla (MASTER §4.7). */
export function useRefetchOnFocus(refetch: () => unknown) {
  const first = useRef(true)
  useFocusEffect(useCallback(() => {
    if (first.current) { first.current = false; return }
    void refetch()
  }, [refetch]))
}
