export interface Profile { first_name: string; last_name: string; phone: string }
export interface User { id: number; email: string; profile: Profile }
export interface Pet {
  id: number; name: string; species: 'Perro' | 'Gato' | 'Ave' | 'Conejo' | 'Otro';
  breed: string; sex: 'Macho' | 'Hembra'; birth_date: string; weight: number;
  color: string; notes: string; created_at: string; updated_at: string;
}
export interface Clinic {
  id: number; name: string; address: string; phone: string;
  opening_hours: string; description: string;
}
export interface Service {
  id: number; clinic_id: number; name: string; description: string;
  duration_minutes: number; price: number;
}
export interface Appointment {
  id: number; pet: Pet; clinic: Clinic; service: Service;
  starts_at: string; reason: string; status: 'Pendiente' | 'Cancelada';
  created_at: string; updated_at: string;
}
