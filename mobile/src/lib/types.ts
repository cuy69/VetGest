// Tipos del contrato de la API (mismos nombres que frontend/src/lib/types.ts),
// más los campos de la ampliación de docs/api.md (token, horario, stage, payment).

export interface Profile { first_name: string; last_name: string; phone: string }
export type Role = 'owner' | 'staff' | 'platform_admin'
export type ClinicRole = 'admin' | 'vet' | 'reception'
export interface Membership { clinic_id: number; clinic_name: string; role: ClinicRole }
export interface User {
  id: number; email: string; role: Role; must_change_password: boolean;
  profile: Profile; membership: Membership | null;
}
export interface TokenResponse { access_token: string; token_type: 'bearer'; expires_in: number; user: User }

export type Species = 'Perro' | 'Gato' | 'Ave' | 'Conejo' | 'Otro'
export interface Pet {
  id: number; name: string; species: Species;
  breed: string; sex: 'Macho' | 'Hembra'; birth_date: string; weight: number;
  color: string; notes: string; created_at: string; updated_at: string;
}
export interface Clinic {
  id: number; name: string; address: string; phone: string;
  opening_hours: string; description: string;
  /** "08:00" */
  opens_at?: string;
  /** "20:00" */
  closes_at?: string;
  /** Días ISO: 1 = lunes … 7 = domingo. */
  open_days?: number[];
}
export interface Service {
  id: number; clinic_id: number; name: string; description: string;
  duration_minutes: number; price: number; is_active: boolean;
}
export type AppointmentStatus = 'Pendiente' | 'Confirmada' | 'Atendida' | 'Cancelada' | 'No asistió'
export type AppointmentStage =
  | 'Por confirmar' | 'Confirmada' | 'En sala de espera' | 'En consulta'
  | 'Atendida' | 'Cancelada' | 'No asistió'
export interface StaffName { id: number; profile: Profile }
export interface Payment { id: number; amount: number; method: 'Efectivo' | 'Yape' | 'Tarjeta'; paid_at: string }
export interface Appointment {
  id: number; pet: Pet; clinic: Clinic; service: Service;
  starts_at: string; reason: string; status: AppointmentStatus;
  vet: StaffName | null; has_record: boolean;
  created_at: string; updated_at: string;
  arrived_at?: string | null; started_at?: string | null;
  stage?: AppointmentStage; payment?: Payment | null;
}
export type CareKind = 'Vacuna' | 'Desparasitación' | 'Tratamiento'
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
export interface Slot { starts_at: string; available: boolean }
export interface Availability { date: string; slots: Slot[] }
