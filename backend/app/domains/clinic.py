"""Clinic workspace for staff: agenda, patients, clinical records, team and services."""

from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import exists, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.core.security import ClinicAdmin, Clinician, Db, FrontDesk, Staff, password_hash
from app.domains.appointments import appointment_options
from app.domains.history import pet_history
from app.domains.scheduling import check_slot, day_slots, lock_agenda, today_bounds
from app.models import (
    Appointment,
    CareEvent,
    ClinicMember,
    InventoryItem,
    InventoryMovement,
    MedicalRecord,
    Pet,
    Profile,
    User,
    VeterinaryClinic,
    VeterinaryService,
)
from app.schemas import (
    AdminClinicOut,
    AppointmentManage,
    AvailabilityOut,
    CareInput,
    CareOut,
    ClinicAppointmentOut,
    ClinicInput,
    HistoryOut,
    PatientOut,
    RecordInput,
    RecordOut,
    ServiceInput,
    ServiceOut,
    StaffInput,
    StaffOut,
    StaffUpdate,
)

router = APIRouter(prefix="/clinic", tags=["Veterinaria"])
LIMA = ZoneInfo("America/Lima")
# Allowed front-desk transitions. "Atendida" is only reached by registering a clinical record.
TRANSITIONS = {
    "Pendiente": {"Confirmada", "Cancelada"},
    "Confirmada": {"Cancelada", "No asistió"},
}


def clinic_appointment(db, member: ClinicMember, appointment_id: int, lock: bool = False) -> Appointment:
    query = select(Appointment).where(Appointment.id == appointment_id, Appointment.clinic_id == member.clinic_id) \
        .options(*appointment_options(), selectinload(Appointment.owner))
    appointment = db.scalar(query.with_for_update(of=Appointment) if lock else query)
    if not appointment:
        raise HTTPException(404, "No encontramos esa cita en tu veterinaria.")
    return appointment


def related_to_clinic(clinic_id: int):
    """A clinic may access a pet once the owner booked with it or it attended the pet."""
    return or_(
        exists().where(Appointment.pet_id == Pet.id, Appointment.clinic_id == clinic_id),
        exists().where(MedicalRecord.pet_id == Pet.id, MedicalRecord.clinic_id == clinic_id),
    )


def clinic_patient(db, member: ClinicMember, pet_id: int) -> Pet:
    pet = db.scalar(select(Pet).where(Pet.id == pet_id, related_to_clinic(member.clinic_id))
                    .options(selectinload(Pet.owner)))
    if not pet:
        raise HTTPException(404, "Esta mascota no es paciente de tu veterinaria.")
    return pet


def clinic_vet(db, member: ClinicMember, vet_id: int) -> ClinicMember:
    vet = db.scalar(select(ClinicMember).join(User).where(
        ClinicMember.user_id == vet_id, ClinicMember.clinic_id == member.clinic_id,
        ClinicMember.role.in_(("vet", "admin")), User.is_active.is_(True)))
    if not vet:
        raise HTTPException(422, "Selecciona un veterinario activo de tu equipo.")
    return vet


# ---- Clinic profile -------------------------------------------------------------------------

@router.get("", response_model=AdminClinicOut)
def my_clinic(member: Staff, db: Db):
    return db.get(VeterinaryClinic, member.clinic_id)


@router.put("", response_model=AdminClinicOut)
def update_clinic(data: ClinicInput, member: ClinicAdmin, db: Db):
    clinic = db.get(VeterinaryClinic, member.clinic_id)
    for key, value in data.columns().items():
        setattr(clinic, key, value)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Ya existe otra veterinaria con ese nombre.") from None
    return clinic


@router.get("/summary")
def summary(member: Staff, db: Db):
    today = datetime.now(LIMA).date()
    start = datetime.combine(today, time.min, LIMA)
    rows = db.execute(select(Appointment.status, func.count()).where(
        Appointment.clinic_id == member.clinic_id, Appointment.starts_at >= start,
        Appointment.starts_at < start + timedelta(days=1)).group_by(Appointment.status)).all()
    pending = db.scalar(select(func.count()).where(Appointment.clinic_id == member.clinic_id,
                                                   Appointment.status == "Pendiente", Appointment.starts_at >= datetime.now(UTC)))
    mine = 0
    if member.role in ("vet", "admin"):
        mine = db.scalar(select(func.count()).where(
            Appointment.vet_id == member.user_id, Appointment.status == "Confirmada",
            Appointment.starts_at >= start, Appointment.starts_at < start + timedelta(days=1)))
    start, end = today_bounds()
    today_confirmed = select(func.count()).where(
        Appointment.clinic_id == member.clinic_id, Appointment.status == "Confirmada",
        Appointment.starts_at >= start, Appointment.starts_at < end)
    waiting = db.scalar(today_confirmed.where(Appointment.arrived_at.is_not(None), Appointment.started_at.is_(None)))
    in_consult = db.scalar(today_confirmed.where(Appointment.started_at.is_not(None)))
    return {"today": dict(rows), "pending_requests": pending, "my_today": mine,
            "waiting": waiting, "in_consult": in_consult}


# ---- Agenda ---------------------------------------------------------------------------------

@router.get("/appointments", response_model=list[ClinicAppointmentOut])
def list_clinic_appointments(member: Staff, db: Db, date_from: date | None = None, date_to: date | None = None,
                             status: str | None = Query(default=None, max_length=12), mine: bool = False):
    query = select(Appointment).where(Appointment.clinic_id == member.clinic_id) \
        .options(*appointment_options(), selectinload(Appointment.owner))
    if date_from:
        query = query.where(Appointment.starts_at >= datetime.combine(date_from, time.min, LIMA))
    if date_to:
        query = query.where(Appointment.starts_at < datetime.combine(date_to + timedelta(days=1), time.min, LIMA))
    if status:
        query = query.where(Appointment.status == status)
    if mine:
        query = query.where(Appointment.vet_id == member.user_id)
    return db.scalars(query.order_by(Appointment.starts_at).limit(500)).all()


@router.get("/appointments/{appointment_id}", response_model=ClinicAppointmentOut)
def get_clinic_appointment(appointment_id: int, member: Staff, db: Db):
    return clinic_appointment(db, member, appointment_id)


@router.patch("/appointments/{appointment_id}", response_model=ClinicAppointmentOut)
def manage_appointment(appointment_id: int, data: AppointmentManage, member: FrontDesk, db: Db):
    appointment = clinic_appointment(db, member, appointment_id, lock=True)
    changes = data.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(422, "No indicaste ningún cambio.")
    editable = appointment.status in TRANSITIONS
    if ("vet_id" in changes or "starts_at" in changes) and not editable:
        raise HTTPException(409, f"La cita está {appointment.status.lower()} y ya no se puede modificar.")
    if appointment.arrived_at and changes.get("starts_at") is not None:
        raise HTTPException(409, "El paciente ya llegó: no se puede reprogramar.")
    if changes.get("vet_id") is not None:
        appointment.vet_id = clinic_vet(db, member, changes["vet_id"]).user_id
    elif "vet_id" in changes:
        appointment.vet_id = None
    new_time = changes.get("starts_at") is not None and data.starts_at != appointment.starts_at
    if new_time and data.starts_at <= datetime.now(UTC):
        raise HTTPException(422, "Elige una fecha y hora futuras.")
    if new_time or changes.get("vet_id") is not None:
        lock_agenda(db, member.clinic_id)
        check_slot(db, appointment.clinic, appointment.service, data.starts_at if new_time else appointment.starts_at,
                   vet_id=appointment.vet_id, exclude_id=appointment.id, new_time=new_time)
    if new_time:
        appointment.starts_at = data.starts_at
    if changes.get("staff_notes") is not None:
        appointment.staff_notes = data.staff_notes
    if changes.get("status") is not None and data.status != appointment.status:
        if data.status not in TRANSITIONS.get(appointment.status, set()):
            raise HTTPException(409, f"No se puede pasar de {appointment.status} a {data.status}.")
        if data.status == "No asistió" and appointment.starts_at > datetime.now(UTC):
            raise HTTPException(409, "Solo puedes marcar inasistencia después de la hora de la cita.")
        if data.status == "No asistió" and appointment.arrived_at:
            raise HTTPException(409, "El paciente llegó a la veterinaria: no se puede marcar inasistencia.")
        appointment.status = data.status
    db.commit()
    db.expire(appointment)  # reload relationships such as the newly assigned vet
    return clinic_appointment(db, member, appointment_id)


@router.get("/availability", response_model=AvailabilityOut)
def staff_availability(member: Staff, db: Db, service_id: int = Query(gt=0), day: date = Query(alias="date"),
                       vet_id: int | None = Query(default=None, gt=0),
                       exclude_appointment_id: int | None = Query(default=None, gt=0)):
    service = db.scalar(select(VeterinaryService).where(VeterinaryService.id == service_id,
                                                        VeterinaryService.clinic_id == member.clinic_id))
    if not service:
        raise HTTPException(422, "Ese servicio no es de tu veterinaria.")
    clinic = db.get(VeterinaryClinic, member.clinic_id)
    return {"date": day, "slots": day_slots(db, clinic, service, day, vet_id, exclude_appointment_id)}


@router.post("/appointments/{appointment_id}/arrival", response_model=ClinicAppointmentOut)
def register_arrival(appointment_id: int, member: FrontDesk, db: Db):
    """Front desk marks that the patient is in the waiting room. Status stays Confirmada."""
    appointment = clinic_appointment(db, member, appointment_id, lock=True)
    start, end = today_bounds()
    if appointment.status != "Confirmada":
        raise HTTPException(409, "Solo se registra la llegada de citas confirmadas.")
    if not start <= appointment.starts_at < end:
        raise HTTPException(409, "Solo se registra la llegada de las citas de hoy.")
    if appointment.arrived_at:
        raise HTTPException(409, "La llegada de este paciente ya está registrada.")
    appointment.arrived_at = datetime.now(UTC)
    db.commit()
    db.expire(appointment)
    return clinic_appointment(db, member, appointment_id)


@router.post("/appointments/{appointment_id}/start", response_model=ClinicAppointmentOut)
def start_consultation(appointment_id: int, member: Clinician, db: Db):
    """The assigned vet calls the patient in. Not a status change: Atendida still needs the record."""
    appointment = clinic_appointment(db, member, appointment_id, lock=True)
    if appointment.vet_id != member.user_id and member.role != "admin":
        raise HTTPException(403, "Esta cita está asignada a otro veterinario.")
    if appointment.status != "Confirmada" or not appointment.arrived_at:
        raise HTTPException(409, "El paciente aún no está en sala de espera.")
    if appointment.started_at:
        raise HTTPException(409, "La consulta ya empezó.")
    appointment.started_at = datetime.now(UTC)
    db.commit()
    db.expire(appointment)
    return clinic_appointment(db, member, appointment_id)


# ---- Patients and clinical history -----------------------------------------------------------

@router.get("/patients", response_model=list[PatientOut])
def list_patients(member: Staff, db: Db, search: str = Query(default="", max_length=80)):
    query = select(Pet).join(Profile, Profile.id == Pet.owner_id).where(related_to_clinic(member.clinic_id)) \
        .options(selectinload(Pet.owner))
    term = search.strip()
    if term:
        query = query.where(or_(Pet.name.icontains(term, autoescape=True),
                                Profile.first_name.icontains(term, autoescape=True),
                                Profile.last_name.icontains(term, autoescape=True)))
    return db.scalars(query.order_by(Pet.name).limit(200)).all()


@router.get("/patients/{pet_id}", response_model=PatientOut)
def get_patient(pet_id: int, member: Staff, db: Db):
    return clinic_patient(db, member, pet_id)


@router.get("/patients/{pet_id}/history", response_model=HistoryOut)
def get_patient_history(pet_id: int, member: Staff, db: Db):
    return pet_history(db, clinic_patient(db, member, pet_id).id)


def add_care(db, member: ClinicMember, pet: Pet, data: CareInput, record_id: int | None = None) -> CareEvent:
    item = None
    if data.inventory_item_id:
        item = db.scalar(select(InventoryItem).where(InventoryItem.id == data.inventory_item_id,
                                                     InventoryItem.clinic_id == member.clinic_id,
                                                     InventoryItem.is_active.is_(True)).with_for_update())
        if not item:
            raise HTTPException(422, "Ese producto no está en el inventario activo de tu veterinaria.")
        if item.stock < 1:
            raise HTTPException(409, f"No queda stock de {item.name}. Registra un ingreso antes de usarlo.")
    event = CareEvent(pet_id=pet.id, clinic_id=member.clinic_id, vet_id=member.user_id, record_id=record_id,
                      **data.model_dump())
    db.add(event)
    if item:
        db.flush()
        item.stock -= 1
        db.add(InventoryMovement(item_id=item.id, clinic_id=member.clinic_id, kind="Uso en atención", quantity=-1,
                                 notes=f"{data.kind}: {data.name} · {pet.name}", user_id=member.user_id,
                                 care_event_id=event.id))
    return event


@router.post("/patients/{pet_id}/records", response_model=RecordOut, status_code=201)
def create_record(pet_id: int, data: RecordInput, member: Clinician, db: Db):
    pet = clinic_patient(db, member, pet_id)
    if pet.deleted_at:
        raise HTTPException(409, "El propietario retiró a esta mascota; no se pueden registrar nuevas atenciones.")
    appointment = None
    if data.appointment_id:
        appointment = clinic_appointment(db, member, data.appointment_id, lock=True)
        if appointment.pet_id != pet.id:
            raise HTTPException(422, "La cita no corresponde a esta mascota.")
        if appointment.status not in ("Pendiente", "Confirmada") or appointment.record:
            raise HTTPException(409, "Esta cita ya fue atendida, cancelada o marcada como inasistencia.")
    record = MedicalRecord(pet_id=pet.id, clinic_id=member.clinic_id, vet_id=member.user_id,
                           appointment_id=data.appointment_id, attended_at=datetime.now(UTC),
                           **data.model_dump(exclude={"appointment_id", "care"}))
    db.add(record)
    db.flush()
    for item in data.care:
        add_care(db, member, pet, item, record.id)
    if appointment:
        appointment.status = "Atendida"
        appointment.vet_id = member.user_id
    if data.weight:
        pet.weight = Decimal(str(data.weight))
    db.commit()
    return db.scalar(select(MedicalRecord).where(MedicalRecord.id == record.id).options(
        selectinload(MedicalRecord.clinic), selectinload(MedicalRecord.vet).selectinload(User.profile)))


@router.post("/patients/{pet_id}/care", response_model=CareOut, status_code=201)
def create_care(pet_id: int, data: CareInput, member: Clinician, db: Db):
    pet = clinic_patient(db, member, pet_id)
    if pet.deleted_at:
        raise HTTPException(409, "El propietario retiró a esta mascota; no se pueden registrar nuevos cuidados.")
    event = add_care(db, member, pet, data)
    db.commit()
    return db.scalar(select(CareEvent).where(CareEvent.id == event.id).options(
        selectinload(CareEvent.clinic), selectinload(CareEvent.vet).selectinload(User.profile)))


# ---- Team -----------------------------------------------------------------------------------

def staff_query(clinic_id: int):
    return select(ClinicMember).where(ClinicMember.clinic_id == clinic_id) \
        .options(selectinload(ClinicMember.user).selectinload(User.profile))


@router.get("/staff", response_model=list[StaffOut])
def list_staff(member: Staff, db: Db):
    return db.scalars(staff_query(member.clinic_id).order_by(ClinicMember.role, ClinicMember.id)).all()


@router.post("/staff", response_model=StaffOut, status_code=201)
def create_staff(data: StaffInput, member: ClinicAdmin, db: Db):
    user = User(email=str(data.email).lower(), password_hash=password_hash.hash(data.temporary_password),
                role="staff", must_change_password=True)
    user.profile = Profile(**data.model_dump(include={"first_name", "last_name", "phone"}))
    db.add(user)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Ya existe una cuenta con este correo.") from None
    staff = ClinicMember(user_id=user.id, clinic_id=member.clinic_id, role=data.role)
    db.add(staff)
    db.commit()
    return db.scalar(staff_query(member.clinic_id).where(ClinicMember.id == staff.id))


@router.patch("/staff/{user_id}", response_model=StaffOut)
def update_staff(user_id: int, data: StaffUpdate, member: ClinicAdmin, db: Db):
    if user_id == member.user_id:
        raise HTTPException(409, "No puedes cambiar tu propio rol ni desactivarte. Pide ayuda a otro administrador.")
    staff = db.scalar(staff_query(member.clinic_id).where(ClinicMember.user_id == user_id).with_for_update(of=ClinicMember))
    if not staff:
        raise HTTPException(404, "No encontramos a ese miembro del equipo.")
    staff.role = data.role
    if staff.user.is_active and not data.is_active:
        staff.user.token_version += 1
    staff.user.is_active = data.is_active
    db.commit()
    return staff


# ---- Services -------------------------------------------------------------------------------

@router.get("/services", response_model=list[ServiceOut])
def list_clinic_services(member: Staff, db: Db):
    return db.scalars(select(VeterinaryService).where(VeterinaryService.clinic_id == member.clinic_id)
                      .order_by(VeterinaryService.is_active.desc(), VeterinaryService.name)).all()


def save_service(db, service: VeterinaryService):
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Tu veterinaria ya tiene un servicio con ese nombre.") from None
    return service


@router.post("/services", response_model=ServiceOut, status_code=201)
def create_service(data: ServiceInput, member: ClinicAdmin, db: Db):
    service = VeterinaryService(clinic_id=member.clinic_id, **data.model_dump())
    db.add(service)
    return save_service(db, service)


@router.put("/services/{service_id}", response_model=ServiceOut)
def update_service(service_id: int, data: ServiceInput, member: ClinicAdmin, db: Db):
    service = db.scalar(select(VeterinaryService).where(VeterinaryService.id == service_id,
                                                        VeterinaryService.clinic_id == member.clinic_id))
    if not service:
        raise HTTPException(404, "No encontramos ese servicio.")
    for key, value in data.model_dump().items():
        setattr(service, key, value)
    return save_service(db, service)
