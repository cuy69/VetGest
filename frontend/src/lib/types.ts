export interface Profile { first_name: string; last_name: string; phone: string }
export type Role = 'owner' | 'staff' | 'platform_admin'
export type ClinicRole = 'admin' | 'vet' | 'reception'
export interface Membership { clinic_id: number; clinic_name: string; role: ClinicRole }
export interface User { id: number; email: string; role: Role; must_change_password: boolean; profile: Profile; membership: Membership | null }
export interface Pet {
  id: number; name: string; species: 'Perro' | 'Gato' | 'Ave' | 'Conejo' | 'Otro';
  breed: string; sex: 'Macho' | 'Hembra'; birth_date: string; weight: number;
  color: string; notes: string; created_at: string; updated_at: string;
}
export interface Clinic {
  id: number; name: string; address: string; phone: string;
  opening_hours: string; description: string;
  /** "HH:MM", hora de Lima. */
  opens_at: string; closes_at: string;
  /** Días ISO: 1 = lunes … 7 = domingo. */
  open_days: number[];
}
export interface Service {
  id: number; clinic_id: number; name: string; description: string;
  duration_minutes: number; price: number; is_active: boolean;
}
export type AppointmentStatus = 'Pendiente' | 'Confirmada' | 'Atendida' | 'Cancelada' | 'No asistió'
export interface StaffName { id: number; profile: Profile }
export type AppointmentStage = 'Por confirmar' | 'Confirmada' | 'En sala de espera' | 'En consulta' | 'Atendida' | 'Cancelada' | 'No asistió'
export type PaymentMethod = 'Efectivo' | 'Yape' | 'Tarjeta'
export interface AppointmentPayment { id: number; amount: number; method: PaymentMethod; paid_at: string }
export interface Appointment {
  id: number; pet: Pet; clinic: Clinic; service: Service;
  starts_at: string; reason: string; status: AppointmentStatus;
  vet: StaffName | null; has_record: boolean;
  arrived_at: string | null; started_at: string | null; stage: AppointmentStage;
  /** Cobro vigente (no anulado) o null. */
  payment: AppointmentPayment | null;
  created_at: string; updated_at: string;
}
export interface ClinicAppointment extends Appointment { owner: Profile; staff_notes: string }
export interface Patient extends Pet { owner: Profile }
export type CareKind = 'Vacuna' | 'Desparasitación' | 'Tratamiento'
/** Cuerpo de una vacuna, desparasitación o tratamiento al registrarlo. */
export interface CareInput {
  kind: CareKind; name: string; dose: string; applied_on: string; next_due_on: string | null; notes: string;
  /** Producto de inventario a descontar (1 unidad). */
  inventory_item_id: number | null;
}
export interface CareEvent {
  id: number; kind: CareKind; name: string; dose: string; applied_on: string;
  next_due_on: string | null; notes: string; clinic: { id: number; name: string }; vet: StaffName;
}
export interface MedicalRecord {
  id: number; pet_id: number; appointment_id: number | null; attended_at: string;
  reason: string; diagnosis: string; indications: string; weight: number | null;
  next_visit_on: string | null; clinic: { id: number; name: string }; vet: StaffName;
}
export interface History { records: MedicalRecord[]; care: CareEvent[] }
export interface Reminder {
  kind: CareKind | 'Control' | 'Cita'; title: string; pet_id: number; pet_name: string;
  due: string; overdue: boolean; clinic_name: string;
}
export interface StaffMember { user_id: number; email: string; role: ClinicRole; is_active: boolean; profile: Profile }
export interface AdminClinic extends Clinic { is_active: boolean; staff_count: number; appointment_count: number }
export interface ClinicSummary { today: Partial<Record<AppointmentStatus, number>>; pending_requests: number; my_today: number; waiting: number; in_consult: number }
export interface PlatformSummary { owners: number; staff: number; pets: number; active_clinics: number; appointments_30d: Partial<Record<AppointmentStatus, number>> }
export interface Slot { starts_at: string; available: boolean }
export interface Availability { date: string; slots: Slot[] }
export interface Payment {
  id: number; appointment_id: number; amount: number; method: PaymentMethod; notes: string; paid_at: string;
  received_by: string | StaffName | null; pet_name: string; owner_name: string; service_name: string;
  voided_at: string | null; void_reason: string | null;
}
/** Desgloses del reporte: el contrato no fija la forma; se aceptan objeto {clave: total} o lista de filas. */
export type IncomeBreakdown = Record<string, number | { total: number; count?: number }> | Array<Record<string, unknown>>
export interface IncomeReport {
  date_from: string; date_to: string; total: number; count: number;
  by_method: IncomeBreakdown; by_day: IncomeBreakdown; by_service: IncomeBreakdown;
  pending: number | { count?: number; total?: number; amount?: number }
  /** Ticket promedio (ingresos / cobros). */
  average_ticket?: number
  /** Citas del periodo por estado (para el % de inasistencia). */
  appointments?: Partial<Record<string, number>>
}
export type InventoryCategory = 'Vacuna' | 'Antiparasitario' | 'Medicamento' | 'Insumo'
export interface InventoryItem {
  id: number; name: string; category: InventoryCategory; unit: string;
  stock: number; min_stock: number; is_active: boolean; low_stock: boolean;
}
export type MovementKind = 'Ingreso' | 'Ajuste' | 'Uso en atención'
export interface Movement {
  id: number; kind: MovementKind; quantity: number; notes: string; created_at: string;
  user: string | StaffName | null; care_event_id: number | null;
}
