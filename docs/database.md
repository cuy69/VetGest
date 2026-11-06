# Modelo de datos (diagrama entidad-relación)

PostgreSQL 17 (Supabase en producción). Fuente de verdad: [`backend/app/models.py`](../backend/app/models.py) y las migraciones de Alembic (`0001`, `0002`, `0003`). Todas las tablas tienen `created_at` y `updated_at`; se omiten en el diagrama.

```mermaid
erDiagram
    users ||--|| profiles : "tiene datos personales"
    users ||--o| clinic_members : "trabaja en (personal)"
    veterinary_clinics ||--o{ clinic_members : "tiene equipo"
    profiles ||--o{ pets : "es dueño de"
    veterinary_clinics ||--o{ veterinary_services : "ofrece"
    profiles ||--o{ appointments : "solicita"
    pets ||--o{ appointments : "es atendida en"
    veterinary_clinics ||--o{ appointments : "recibe"
    veterinary_services ||--o{ appointments : "corresponde a"
    users |o--o{ appointments : "veterinario asignado"
    pets ||--o{ medical_records : "historial"
    veterinary_clinics ||--o{ medical_records : "registra"
    users ||--o{ medical_records : "firma (veterinario)"
    appointments |o--o| medical_records : "se atiende con"
    pets ||--o{ care_events : "cartilla"
    medical_records |o--o{ care_events : "incluye"
    appointments ||--o{ payments : "se cobra (uno vigente)"
    veterinary_clinics ||--o{ inventory_items : "tiene stock"
    inventory_items ||--o{ inventory_movements : "cambia con"
    inventory_items |o--o{ care_events : "se usa en"
    care_events |o--o| inventory_movements : "descuenta"
    veterinary_clinics ||--o{ care_events : "aplica"
    users ||--o{ care_events : "aplica (veterinario)"

    users {
        int id PK
        varchar email UK "minúsculas"
        varchar password_hash "Argon2id"
        int token_version "revoca sesiones"
        varchar role "owner | staff | platform_admin"
        bool is_active
        bool must_change_password
    }
    profiles {
        int id PK
        int user_id FK,UK
        varchar first_name
        varchar last_name
        varchar phone
    }
    veterinary_clinics {
        int id PK
        varchar name UK
        varchar address
        varchar phone
        varchar opening_hours
        text description
        bool is_active "suspendida = false"
        time opens_at "horario para turnos"
        time closes_at
        varchar open_days "días ISO, p. ej. 123456"
    }
    clinic_members {
        int id PK
        int user_id FK,UK "una veterinaria por cuenta"
        int clinic_id FK
        varchar role "admin | vet | reception"
    }
    pets {
        int id PK
        int owner_id FK "profiles"
        varchar name
        varchar species "Perro | Gato | Ave | Conejo | Otro"
        varchar breed
        varchar sex "Macho | Hembra"
        date birth_date
        numeric weight "0 a 1000 kg"
        varchar color
        text notes
        timestamptz deleted_at "baja lógica"
    }
    veterinary_services {
        int id PK
        int clinic_id FK
        varchar name "único por veterinaria"
        text description
        int duration_minutes
        numeric price "soles"
        bool is_active "retirado = false"
    }
    appointments {
        int id PK
        int owner_id FK
        int pet_id FK "con owner_id: la mascota es del dueño"
        int clinic_id FK
        int service_id FK "con clinic_id: el servicio es de la veterinaria"
        int vet_id FK "nullable"
        timestamptz starts_at
        text reason
        varchar status "Pendiente | Confirmada | Atendida | Cancelada | No asistió"
        text staff_notes "solo personal"
        timestamptz arrived_at "sala de espera"
        timestamptz started_at "en consulta"
    }
    payments {
        int id PK
        int clinic_id FK
        int appointment_id FK "único si no está anulado"
        numeric amount "soles"
        varchar method "Efectivo | Yape | Tarjeta"
        timestamptz paid_at
        int received_by_id FK
        timestamptz voided_at "anulación con motivo"
        text void_reason
    }
    inventory_items {
        int id PK
        int clinic_id FK
        varchar name "único por veterinaria"
        varchar category "Vacuna | Antiparasitario | Medicamento | Insumo"
        varchar unit
        int stock "nunca negativo"
        int min_stock "alerta de stock bajo"
        bool is_active
    }
    inventory_movements {
        int id PK
        int item_id FK
        varchar kind "Ingreso | Ajuste | Uso en atención"
        int quantity "distinto de 0"
        int user_id FK
        int care_event_id FK "nullable"
    }
    medical_records {
        int id PK
        int pet_id FK
        int clinic_id FK
        int vet_id FK
        int appointment_id FK,UK "nullable"
        timestamptz attended_at
        text reason
        text diagnosis
        text indications
        numeric weight "nullable"
        date next_visit_on "genera recordatorio"
    }
    care_events {
        int id PK
        int pet_id FK
        int clinic_id FK
        int vet_id FK
        int record_id FK "nullable"
        varchar kind "Vacuna | Desparasitación | Tratamiento"
        varchar name
        varchar dose
        date applied_on
        date next_due_on "genera recordatorio"
        text notes
        int inventory_item_id FK "nullable: producto usado"
    }
```

## Equivalencia con el diagrama de clases del Avance 2

| Avance 2 (PDF) | Implementación | Cambio y motivo |
|---|---|---|
| Propietario | `users` + `profiles` | Se separan credenciales y datos personales. `profiles` también sirve al personal, así la persona y su cuenta son una sola entidad para todos los roles |
| — | `clinic_members` | Nuevo: vincula al personal con su veterinaria y su rol (admin, veterinario, recepción) |
| Veterinaria | `veterinary_clinics` | Se añade `is_active` para suspender una veterinaria sin perder su historial |
| ServicioVeterinario | `veterinary_services` | Se añade `is_active`: un servicio retirado se oculta, pero sigue en citas pasadas |
| Mascota | `pets` | Baja lógica (`deleted_at`) para no perder historial; el estado del PDF se cubre con esa baja |
| Cita | `appointments` | Fecha y hora unidas en `starts_at` con zona horaria; flujo de estados ampliado; veterinario asignado y notas internas |
| Historial_Vet | `medical_records` | Vinculado a la veterinaria, al veterinario que firma y, opcionalmente, a la cita (1 a 1) |
| Tratamiento | `care_events` | Unifica vacunas, desparasitaciones y tratamientos con `kind`. `next_due_on` alimenta los recordatorios |

## Reglas de integridad en la base de datos

- **Claves foráneas compuestas** en `appointments`: `(pet_id, owner_id) → pets` y `(service_id, clinic_id) → veterinary_services`. La base rechaza una cita con una mascota ajena o un servicio de otra veterinaria, aunque falle la validación de la API.
- **CHECK** en roles, estados, especies, sexo, peso, precio, duración, `next_due_on ≥ applied_on`, horario (`closes_at > opens_at`), `started_at` solo con `arrived_at`, métodos de pago, stock no negativo y movimientos distintos de cero.
- **Índice único parcial** `uq_payment_appointment_valid`: una cita tiene como máximo un cobro no anulado.
- **ON DELETE RESTRICT** en todas las relaciones: nada clínico se borra en cascada.
- **Índices** para la agenda (`clinic_id, starts_at`), las citas del propietario (`owner_id, status, starts_at`) y los recordatorios (`pet_id, next_due_on`).
- **Trigger** `vetgest_touch_updated_at` mantiene `updated_at` aunque se actualice fuera de SQLAlchemy.
- **Supabase:** RLS activado sin políticas y permisos revocados a `anon` y `authenticated`. Solo el backend accede a los datos.
