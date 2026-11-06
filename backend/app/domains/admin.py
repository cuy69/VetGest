"""Platform administration: clinic onboarding, suspension and global metrics."""

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, HTTPException
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError

from app.core.security import Db, PlatformAdmin, password_hash
from app.models import Appointment, ClinicMember, Pet, Profile, User, VeterinaryClinic
from app.schemas import AdminClinicOut, ClinicCreate, ClinicStatusInput

router = APIRouter(prefix="/admin", tags=["Administración de VetGest"])


def clinics_with_counts(db, clinic_id: int | None = None):
    staff = select(func.count()).where(ClinicMember.clinic_id == VeterinaryClinic.id).scalar_subquery()
    appointments = select(func.count()).where(Appointment.clinic_id == VeterinaryClinic.id).scalar_subquery()
    query = select(VeterinaryClinic, staff, appointments).order_by(VeterinaryClinic.name)
    if clinic_id is not None:
        query = query.where(VeterinaryClinic.id == clinic_id)
    return [AdminClinicOut.model_validate(clinic).model_copy(update={"staff_count": s, "appointment_count": a})
            for clinic, s, a in db.execute(query).all()]


@router.get("/summary")
def summary(admin: PlatformAdmin, db: Db):
    since = datetime.now(UTC) - timedelta(days=30)
    by_status = db.execute(select(Appointment.status, func.count()).where(Appointment.created_at >= since)
                           .group_by(Appointment.status)).all()
    return {
        "owners": db.scalar(select(func.count()).where(User.role == "owner")),
        "staff": db.scalar(select(func.count()).where(User.role == "staff", User.is_active.is_(True))),
        "pets": db.scalar(select(func.count()).where(Pet.deleted_at.is_(None))),
        "active_clinics": db.scalar(select(func.count()).where(VeterinaryClinic.is_active.is_(True))),
        "appointments_30d": dict(by_status),
    }


@router.get("/clinics", response_model=list[AdminClinicOut])
def list_clinics(admin: PlatformAdmin, db: Db):
    return clinics_with_counts(db)


@router.post("/clinics", response_model=AdminClinicOut, status_code=201)
def create_clinic(data: ClinicCreate, admin: PlatformAdmin, db: Db):
    """Creates the clinic together with its first administrator (temporary password)."""
    clinic = VeterinaryClinic(**{k: v for k, v in data.columns().items() if k != "admin"})
    owner = data.admin
    user = User(email=str(owner.email).lower(), password_hash=password_hash.hash(owner.temporary_password),
                role="staff", must_change_password=True)
    user.profile = Profile(**owner.model_dump(include={"first_name", "last_name", "phone"}))
    db.add_all([clinic, user])
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Ya existe una veterinaria con ese nombre o una cuenta con ese correo.") from None
    db.add(ClinicMember(user_id=user.id, clinic_id=clinic.id, role="admin"))
    db.commit()
    return clinics_with_counts(db, clinic.id)[0]


@router.patch("/clinics/{clinic_id}/status", response_model=AdminClinicOut)
def set_clinic_status(clinic_id: int, data: ClinicStatusInput, admin: PlatformAdmin, db: Db):
    clinic = db.get(VeterinaryClinic, clinic_id, with_for_update=True)
    if not clinic:
        raise HTTPException(404, "No encontramos esa veterinaria.")
    if clinic.is_active and not data.is_active:
        # Suspension signs out the whole team immediately.
        members = select(ClinicMember.user_id).where(ClinicMember.clinic_id == clinic.id)
        db.execute(update(User).where(User.id.in_(members)).values(token_version=User.token_version + 1))
    clinic.is_active = data.is_active
    db.commit()
    return clinics_with_counts(db, clinic.id)[0]
