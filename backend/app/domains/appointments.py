from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.security import CurrentUser, Db
from app.domains.pets import owned_pet
from app.models import Appointment, VeterinaryService
from app.schemas import AppointmentInput, AppointmentOut

router = APIRouter(prefix="/appointments", tags=["Citas"])


def appointment_query(owner_id: int):
    return select(Appointment).where(Appointment.owner_id == owner_id).options(
        selectinload(Appointment.pet), selectinload(Appointment.clinic), selectinload(Appointment.service)
    )


def owned_appointment(db, owner_id: int, appointment_id: int, lock: bool = False):
    query = appointment_query(owner_id).where(Appointment.id == appointment_id)
    appointment = db.scalar(query.with_for_update() if lock else query)
    if not appointment:
        raise HTTPException(404, "No encontramos esa cita.")
    return appointment


@router.get("", response_model=list[AppointmentOut])
def list_appointments(user: CurrentUser, db: Db):
    return db.scalars(appointment_query(user.profile.id).order_by(Appointment.starts_at.desc())).all()


@router.post("", response_model=AppointmentOut, status_code=201)
def create_appointment(data: AppointmentInput, user: CurrentUser, db: Db):
    owned_pet(db, user.profile.id, data.pet_id, lock=True)
    service = db.get(VeterinaryService, data.service_id)
    if not service or service.clinic_id != data.clinic_id:
        raise HTTPException(422, "El servicio no pertenece a la veterinaria seleccionada.")
    if data.starts_at <= datetime.now(UTC):
        raise HTTPException(422, "Elige una fecha y hora futuras.")
    appointment = Appointment(owner_id=user.profile.id, **data.model_dump())
    db.add(appointment)
    db.commit()
    return owned_appointment(db, user.profile.id, appointment.id)


@router.get("/{appointment_id}", response_model=AppointmentOut)
def get_appointment(appointment_id: int, user: CurrentUser, db: Db):
    return owned_appointment(db, user.profile.id, appointment_id)


@router.patch("/{appointment_id}/cancel", response_model=AppointmentOut)
def cancel_appointment(appointment_id: int, user: CurrentUser, db: Db):
    appointment = owned_appointment(db, user.profile.id, appointment_id, lock=True)
    if appointment.status != "Pendiente":
        raise HTTPException(409, "Esta cita ya está cancelada.")
    appointment.status = "Cancelada"
    db.commit()
    return appointment
