"""Slot availability: clinic hours, number of active vets and overlapping appointments."""

from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy import func, select

from app.models import Appointment, ClinicMember, User, VeterinaryClinic, VeterinaryService

LIMA = ZoneInfo("America/Lima")
STEP = timedelta(minutes=30)
# Requests and confirmed appointments hold a slot; attended, cancelled and no-shows release it.
HOLDING = ("Pendiente", "Confirmada")
OUT_OF_HOURS = "Ese horario está fuera de la atención de la veterinaria. Elige otro."
TAKEN = "Ese horario ya no está disponible. Elige otro."
VET_BUSY = "El veterinario ya tiene una cita que se cruza con ese horario."


def lock_agenda(db, clinic_id: int) -> None:
    """Serialises slot checks of one clinic until the transaction ends (no double booking)."""
    db.execute(select(func.pg_advisory_xact_lock(7_000_000 + clinic_id)))


def capacity(db, clinic_id: int) -> int:
    """Simultaneous appointments a clinic can take: its active vets (admins if it has no vets)."""
    def count(role: str) -> int:
        return db.scalar(select(func.count()).select_from(ClinicMember).join(User).where(
            ClinicMember.clinic_id == clinic_id, ClinicMember.role == role, User.is_active.is_(True)))
    return max(count("vet") or count("admin"), 1)


def busy(db, clinic_id: int, start: datetime, end: datetime, exclude_id: int | None = None):
    """(start, end, vet_id) of holding appointments that may overlap [start, end)."""
    query = select(Appointment.starts_at, VeterinaryService.duration_minutes, Appointment.vet_id) \
        .join(VeterinaryService, VeterinaryService.id == Appointment.service_id) \
        .where(Appointment.clinic_id == clinic_id, Appointment.status.in_(HOLDING),
               Appointment.starts_at < end, Appointment.starts_at > start - timedelta(hours=12))
    if exclude_id:
        query = query.where(Appointment.id != exclude_id)
    return [(s, s + timedelta(minutes=m), v) for s, m, v in db.execute(query).all()]


def within_hours(clinic: VeterinaryClinic, start: datetime, minutes: int) -> bool:
    local = start.astimezone(LIMA)
    end = local + timedelta(minutes=minutes)
    return (str(local.isoweekday()) in clinic.open_days and end.date() == local.date()
            and local.time() >= clinic.opens_at and end.time() <= clinic.closes_at)


def is_free(intervals, start: datetime, end: datetime, cap: int, vet_id: int | None) -> bool:
    overlapping = [v for s, e, v in intervals if s < end and e > start]
    if vet_id is not None:
        return vet_id not in overlapping
    return len(overlapping) < cap


def check_slot(db, clinic: VeterinaryClinic, service: VeterinaryService, start: datetime,
               vet_id: int | None = None, exclude_id: int | None = None, new_time: bool = True) -> None:
    """New time: must be within hours and below capacity. With a vet: that vet must be free."""
    end = start + timedelta(minutes=service.duration_minutes)
    intervals = busy(db, clinic.id, start, end, exclude_id)
    if new_time:
        if not within_hours(clinic, start, service.duration_minutes):
            raise HTTPException(422, OUT_OF_HOURS)
        if not is_free(intervals, start, end, capacity(db, clinic.id), None):
            raise HTTPException(409, TAKEN)
    if vet_id is not None and not is_free(intervals, start, end, 0, vet_id):
        raise HTTPException(409, VET_BUSY)


def day_slots(db, clinic: VeterinaryClinic, service: VeterinaryService, day: date,
              vet_id: int | None = None, exclude_id: int | None = None) -> list[dict]:
    if str(day.isoweekday()) not in clinic.open_days:
        return []
    opens = datetime.combine(day, clinic.opens_at, LIMA)
    closes = datetime.combine(day, clinic.closes_at, LIMA)
    duration = timedelta(minutes=service.duration_minutes)
    intervals = busy(db, clinic.id, opens, closes, exclude_id)
    cap = capacity(db, clinic.id)
    now = datetime.now(UTC)
    slots, start = [], opens
    while start + duration <= closes:
        end = start + duration
        free = start > now and is_free(intervals, start, end, cap, None) and \
            (vet_id is None or is_free(intervals, start, end, 0, vet_id))
        slots.append({"starts_at": start, "available": free})
        start += STEP
    return slots


def today_bounds() -> tuple[datetime, datetime]:
    start = datetime.combine(datetime.now(LIMA).date(), time.min, LIMA)
    return start, start + timedelta(days=1)
