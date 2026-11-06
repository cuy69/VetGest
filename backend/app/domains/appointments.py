from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.core.security import CurrentUser, Db, Owner
from app.domains.pets import owned_pet
from app.domains.scheduling import check_slot, day_slots, lock_agenda
from app.models import (
    Appointment,
    CareEvent,
    MedicalRecord,
    Pet,
    User,
    VeterinaryClinic,
    VeterinaryService,
)
from app.schemas import AppointmentInput, AppointmentOut, AvailabilityOut, Reminder

router = APIRouter(tags=["Citas"])
REMINDER_DAYS = 30


def appointment_options():
    return (selectinload(Appointment.pet), selectinload(Appointment.clinic), selectinload(Appointment.service),
            selectinload(Appointment.vet).selectinload(User.profile), selectinload(Appointment.record),
            selectinload(Appointment.payments))


def appointment_query(owner_id: int):
    return select(Appointment).where(Appointment.owner_id == owner_id).options(*appointment_options())


def owned_appointment(db, owner_id: int, appointment_id: int, lock: bool = False):
    query = appointment_query(owner_id).where(Appointment.id == appointment_id)
    appointment = db.scalar(query.with_for_update(of=Appointment) if lock else query)
    if not appointment:
        raise HTTPException(404, "No encontramos esa cita.")
    return appointment


@router.get("/appointments", response_model=list[AppointmentOut])
def list_appointments(user: Owner, db: Db):
    return db.scalars(appointment_query(user.profile.id).order_by(Appointment.starts_at.desc())).all()


@router.post("/appointments", response_model=AppointmentOut, status_code=201)
def create_appointment(data: AppointmentInput, user: Owner, db: Db):
    owned_pet(db, user.profile.id, data.pet_id, lock=True)
    service = db.get(VeterinaryService, data.service_id)
    if not service or service.clinic_id != data.clinic_id:
        raise HTTPException(422, "El servicio no pertenece a la veterinaria seleccionada.")
    clinic = db.get(VeterinaryClinic, data.clinic_id)
    if not service.is_active or not clinic or not clinic.is_active:
        raise HTTPException(422, "Este servicio o veterinaria no está disponible actualmente.")
    if data.starts_at <= datetime.now(UTC):
        raise HTTPException(422, "Elige una fecha y hora futuras.")
    lock_agenda(db, clinic.id)
    check_slot(db, clinic, service, data.starts_at)
    appointment = Appointment(owner_id=user.profile.id, **data.model_dump())
    db.add(appointment)
    db.commit()
    return owned_appointment(db, user.profile.id, appointment.id)


@router.get("/clinics/{clinic_id}/availability", response_model=AvailabilityOut, tags=["Veterinarias y servicios"])
def availability(clinic_id: int, user: CurrentUser, db: Db, service_id: int = Query(gt=0),
                 day: date = Query(alias="date")):
    """Bookable 30-minute slots of a day for a service (Lima time)."""
    clinic = db.get(VeterinaryClinic, clinic_id)
    service = db.get(VeterinaryService, service_id)
    if not clinic or not clinic.is_active:
        raise HTTPException(404, "No encontramos esa veterinaria.")
    if not service or service.clinic_id != clinic.id or not service.is_active:
        raise HTTPException(422, "El servicio no pertenece a la veterinaria seleccionada.")
    return {"date": day, "slots": day_slots(db, clinic, service, day)}


@router.get("/appointments/{appointment_id}", response_model=AppointmentOut)
def get_appointment(appointment_id: int, user: Owner, db: Db):
    return owned_appointment(db, user.profile.id, appointment_id)


@router.patch("/appointments/{appointment_id}/cancel", response_model=AppointmentOut)
def cancel_appointment(appointment_id: int, user: Owner, db: Db):
    appointment = owned_appointment(db, user.profile.id, appointment_id, lock=True)
    if appointment.status not in ("Pendiente", "Confirmada"):
        raise HTTPException(409, f"Esta cita ya no se puede cancelar: está {appointment.status.lower()}.")
    if appointment.arrived_at:
        raise HTTPException(409, "Ya estás en la veterinaria: pide a recepción que cancele la cita.")
    appointment.status = "Cancelada"
    db.commit()
    return appointment


@router.get("/reminders", response_model=list[Reminder], tags=["Recordatorios"])
def reminders(user: Owner, db: Db):
    """Overdue or upcoming (30 days) vaccines, treatments, check-ups and appointments."""
    today = datetime.now(ZoneInfo("America/Lima")).date()
    horizon = today + timedelta(days=REMINDER_DAYS)
    pets = select(Pet.id).where(Pet.owner_id == user.profile.id, Pet.deleted_at.is_(None))
    items: list[Reminder] = []
    # Only the latest event of each kind/name per pet matters: a newer dose supersedes older ones.
    latest = (select(CareEvent.id).distinct(CareEvent.pet_id, CareEvent.kind, func.lower(CareEvent.name))
              .where(CareEvent.pet_id.in_(pets))
              .order_by(CareEvent.pet_id, CareEvent.kind, func.lower(CareEvent.name), CareEvent.applied_on.desc(), CareEvent.id.desc()))
    care = db.execute(select(CareEvent, Pet.name, VeterinaryClinic.name).join(Pet, Pet.id == CareEvent.pet_id)
                      .join(VeterinaryClinic, VeterinaryClinic.id == CareEvent.clinic_id)
                      .where(CareEvent.id.in_(latest), CareEvent.next_due_on.is_not(None), CareEvent.next_due_on <= horizon)).all()
    for event, pet_name, clinic_name in care:
        items.append(Reminder(kind=event.kind, title=f"{event.kind}: {event.name}", pet_id=event.pet_id, pet_name=pet_name,
                              due=event.next_due_on, overdue=event.next_due_on < today, clinic_name=clinic_name))
    latest_record = (select(MedicalRecord.id).distinct(MedicalRecord.pet_id).where(MedicalRecord.pet_id.in_(pets))
                     .order_by(MedicalRecord.pet_id, MedicalRecord.attended_at.desc()))
    visits = db.execute(select(MedicalRecord, Pet.name, VeterinaryClinic.name).join(Pet, Pet.id == MedicalRecord.pet_id)
                        .join(VeterinaryClinic, VeterinaryClinic.id == MedicalRecord.clinic_id)
                        .where(MedicalRecord.id.in_(latest_record), MedicalRecord.next_visit_on.is_not(None),
                               MedicalRecord.next_visit_on <= horizon)).all()
    for record, pet_name, clinic_name in visits:
        items.append(Reminder(kind="Control", title="Control recomendado", pet_id=record.pet_id, pet_name=pet_name,
                              due=record.next_visit_on, overdue=record.next_visit_on < today, clinic_name=clinic_name))
    upcoming = db.scalars(appointment_query(user.profile.id).where(
        Appointment.status.in_(("Pendiente", "Confirmada")), Appointment.starts_at >= datetime.now(UTC),
        Appointment.starts_at < datetime.combine(horizon, datetime.min.time(), ZoneInfo("America/Lima")))).all()
    for a in upcoming:
        items.append(Reminder(kind="Cita", title=f"{a.service.name} ({a.status.lower()})", pet_id=a.pet_id, pet_name=a.pet.name,
                              due=a.starts_at.astimezone(ZoneInfo("America/Lima")).date(), overdue=False, clinic_name=a.clinic.name))
    return sorted(items, key=lambda r: (r.due, r.kind))
