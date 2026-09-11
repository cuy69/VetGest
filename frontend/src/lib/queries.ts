import { useQuery } from '@tanstack/react-query'
import { api, ApiError } from './api'
import type { Appointment, Clinic, Pet, Service, User } from './types'

export function useMe() {
  return useQuery({ queryKey: ['me'], queryFn: async () => {
    try { return await api<User>('/auth/me') } catch (e) {
      if (e instanceof ApiError && e.status === 401) return null
      throw e
    }
  }, staleTime: 60_000, retry: false })
}
export const usePets = () => useQuery({ queryKey: ['pets'], queryFn: () => api<Pet[]>('/pets') })
export const usePet = (id: string | undefined) => useQuery({ queryKey: ['pets', id], queryFn: () => api<Pet>(`/pets/${id}`), enabled: !!id })
export const useClinics = (search = '') => useQuery({ queryKey: ['clinics', search], queryFn: () => api<Clinic[]>(`/clinics?search=${encodeURIComponent(search)}`) })
export const useClinic = (id: string | undefined) => useQuery({ queryKey: ['clinics', 'detail', id], queryFn: () => api<Clinic>(`/clinics/${id}`), enabled: !!id })
export const useServices = (id: string | number | undefined) => useQuery({ queryKey: ['services', String(id)], queryFn: () => api<Service[]>(`/services?clinic_id=${id}`), enabled: !!id })
export const useAppointments = () => useQuery({ queryKey: ['appointments'], queryFn: () => api<Appointment[]>('/appointments') })
export const useAppointment = (id: string | undefined) => useQuery({ queryKey: ['appointments', id], queryFn: () => api<Appointment>(`/appointments/${id}`), enabled: !!id })
