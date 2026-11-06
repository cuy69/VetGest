import { useQuery } from '@tanstack/react-query'
import { api, ApiError } from './api'
import { todayLima } from './schemas'
import type { AdminClinic, Appointment, Availability, Clinic, ClinicAppointment, ClinicSummary, History, IncomeReport, InventoryItem, Movement, Patient, Payment, Pet, PlatformSummary, Reminder, Service, StaffMember, User } from './types'

const qs = (params: Record<string, string | boolean | undefined>) => new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== false).map(([k, v]) => [k, String(v)])).toString()

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
/** Intervalo de consulta en vivo de la sala de espera (contrato: cada 30 s). */
export const LIVE_INTERVAL = 30_000
const limaDate = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso))
/** Cita de hoy (Lima) que todavía puede cambiar de etapa. */
export const isLiveToday = (a: Pick<Appointment, 'starts_at' | 'status'>) => (a.status === 'Pendiente' || a.status === 'Confirmada') && limaDate(a.starts_at) === todayLima()
export const useAppointments = () => useQuery({
  queryKey: ['appointments'], queryFn: () => api<Appointment[]>('/appointments'),
  refetchInterval: query => query.state.data?.some(isLiveToday) ? LIVE_INTERVAL : false,
})
export const useAppointment = (id: string | undefined) => useQuery({
  queryKey: ['appointments', id], queryFn: () => api<Appointment>(`/appointments/${id}`), enabled: !!id,
  refetchInterval: query => query.state.data && isLiveToday(query.state.data) ? LIVE_INTERVAL : false,
})
export const useAvailability = (clinicId: number, serviceId: number, date: string) => useQuery({
  queryKey: ['availability', clinicId, serviceId, date],
  queryFn: () => api<Availability>(`/clinics/${clinicId}/availability?${qs({ service_id: String(serviceId), date })}`),
  enabled: clinicId > 0 && serviceId > 0 && !!date,
})
export const usePetHistory = (id: string | undefined) => useQuery({ queryKey: ['pets', id, 'history'], queryFn: () => api<History>(`/pets/${id}/history`), enabled: !!id })
export const useReminders = () => useQuery({ queryKey: ['reminders'], queryFn: () => api<Reminder[]>('/reminders') })

export interface AgendaFilter { date_from?: string; date_to?: string; status?: string; mine?: boolean }
export const useMyClinic = () => useQuery({ queryKey: ['clinic'], queryFn: () => api<AdminClinic>('/clinic') })
export const useClinicSummary = (live = false) => useQuery({ queryKey: ['clinic', 'summary'], queryFn: () => api<ClinicSummary>('/clinic/summary'), refetchInterval: live ? LIVE_INTERVAL : false })
export const useAgenda = (filter: AgendaFilter, live = false, enabled = true) => useQuery({ queryKey: ['clinic', 'appointments', filter], queryFn: () => api<ClinicAppointment[]>(`/clinic/appointments?${qs({ ...filter })}`), refetchInterval: live ? LIVE_INTERVAL : false, enabled })
export interface StaffAvailabilityFilter { service_id: number; date: string; vet_id?: number | null; exclude_appointment_id?: number }
export const useStaffAvailability = (f: StaffAvailabilityFilter, enabled = true) => useQuery({
  queryKey: ['clinic', 'availability', f],
  queryFn: () => api<Availability>(`/clinic/availability?${qs({ service_id: String(f.service_id), date: f.date, vet_id: f.vet_id ? String(f.vet_id) : undefined, exclude_appointment_id: f.exclude_appointment_id ? String(f.exclude_appointment_id) : undefined })}`),
  enabled: enabled && f.service_id > 0 && !!f.date,
})
export const usePendingPayments = (enabled = true) => useQuery({ queryKey: ['clinic', 'payments', 'pending'], queryFn: () => api<ClinicAppointment[]>('/clinic/payments/pending'), enabled, refetchInterval: enabled ? LIVE_INTERVAL : false })
export const usePayments = (date_from: string, date_to: string) => useQuery({ queryKey: ['clinic', 'payments', 'list', date_from, date_to], queryFn: () => api<Payment[]>(`/clinic/payments?${qs({ date_from, date_to })}`) })
export const useIncomeReport = (date_from: string, date_to: string) => useQuery({ queryKey: ['clinic', 'reports', 'income', date_from, date_to], queryFn: () => api<IncomeReport>(`/clinic/reports/income?${qs({ date_from, date_to })}`) })
export const useInventory = (enabled = true) => useQuery({ queryKey: ['clinic', 'inventory'], queryFn: () => api<InventoryItem[]>('/clinic/inventory'), enabled })
export const useMovements = (id: number | null) => useQuery({ queryKey: ['clinic', 'inventory', id, 'movements'], queryFn: () => api<Movement[]>(`/clinic/inventory/${id}/movements`), enabled: !!id })
export const useClinicAppointment = (id: string | undefined) => useQuery({ queryKey: ['clinic', 'appointments', 'detail', id], queryFn: () => api<ClinicAppointment>(`/clinic/appointments/${id}`), enabled: !!id })
export const usePatients = (search = '') => useQuery({ queryKey: ['clinic', 'patients', search], queryFn: () => api<Patient[]>(`/clinic/patients?${qs({ search })}`) })
export const usePatient = (id: string | undefined) => useQuery({ queryKey: ['clinic', 'patients', 'detail', id], queryFn: () => api<Patient>(`/clinic/patients/${id}`), enabled: !!id })
export const usePatientHistory = (id: string | undefined) => useQuery({ queryKey: ['clinic', 'patients', 'detail', id, 'history'], queryFn: () => api<History>(`/clinic/patients/${id}/history`), enabled: !!id })
export const useStaff = () => useQuery({ queryKey: ['clinic', 'staff'], queryFn: () => api<StaffMember[]>('/clinic/staff') })
export const useClinicServices = () => useQuery({ queryKey: ['clinic', 'services'], queryFn: () => api<Service[]>('/clinic/services') })
export const usePlatformSummary = () => useQuery({ queryKey: ['admin', 'summary'], queryFn: () => api<PlatformSummary>('/admin/summary') })
export const useAdminClinics = () => useQuery({ queryKey: ['admin', 'clinics'], queryFn: () => api<AdminClinic[]>('/admin/clinics') })
