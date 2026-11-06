"""Clinic operations: front-desk payments, income reports and inventory."""

from collections import defaultdict
from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal

from fastapi import APIRouter, HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.core.security import ClinicAdmin, Db, FrontDesk, Staff
from app.domains.appointments import appointment_options
from app.domains.clinic import clinic_appointment
from app.domains.scheduling import LIMA
from app.models import Appointment, InventoryItem, InventoryMovement, Payment, User
from app.schemas import (
    ClinicAppointmentOut,
    IncomeReport,
    InventoryCreate,
    InventoryItemOut,
    InventoryUpdate,
    MovementInput,
    MovementOut,
    PaymentInput,
    PaymentOut,
    VoidInput,
)

router = APIRouter(prefix="/clinic", tags=["Caja e inventario"])
METHODS = ("Efectivo", "Yape", "Tarjeta")


def lima_range(date_from: date | None, date_to: date | None, default_days: int) -> tuple[date, date]:
    today = datetime.now(LIMA).date()
    date_to = date_to or today
    date_from = date_from or date_to - timedelta(days=default_days)
    if date_from > date_to:
        raise HTTPException(422, "La fecha inicial debe ser anterior a la final.")
    if (date_to - date_from).days > 366:
        raise HTTPException(422, "Consulta como máximo un año a la vez.")
    return date_from, date_to


def bounds(date_from: date, date_to: date) -> tuple[datetime, datetime]:
    return datetime.combine(date_from, time.min, LIMA), datetime.combine(date_to + timedelta(days=1), time.min, LIMA)


def payment_query(clinic_id: int):
    appointment = selectinload(Payment.appointment)
    return select(Payment).where(Payment.clinic_id == clinic_id).options(
        appointment.selectinload(Appointment.pet), appointment.selectinload(Appointment.service),
        appointment.selectinload(Appointment.owner), selectinload(Payment.received_by).selectinload(User.profile))


# ---- Payments -------------------------------------------------------------------------------

@router.get("/payments/pending", response_model=list[ClinicAppointmentOut])
def pending_payments(member: FrontDesk, db: Db):
    paid = select(Payment.appointment_id).where(Payment.voided_at.is_(None))
    return db.scalars(select(Appointment).where(
        Appointment.clinic_id == member.clinic_id, Appointment.status == "Atendida", Appointment.id.not_in(paid))
        .options(*appointment_options(), selectinload(Appointment.owner))
        .order_by(Appointment.starts_at.desc()).limit(200)).all()


@router.get("/payments", response_model=list[PaymentOut])
def list_payments(member: FrontDesk, db: Db, date_from: date | None = None, date_to: date | None = None):
    start, end = bounds(*lima_range(date_from, date_to, 0))
    return db.scalars(payment_query(member.clinic_id).where(Payment.paid_at >= start, Payment.paid_at < end)
                      .order_by(Payment.paid_at.desc())).all()


@router.post("/payments", response_model=PaymentOut, status_code=201)
def create_payment(data: PaymentInput, member: FrontDesk, db: Db):
    appointment = clinic_appointment(db, member, data.appointment_id, lock=True)
    if appointment.status != "Atendida":
        raise HTTPException(409, "Solo se cobran citas atendidas.")
    if appointment.payment:
        raise HTTPException(409, "Esta cita ya tiene un cobro registrado.")
    payment = Payment(clinic_id=member.clinic_id, appointment_id=appointment.id, amount=Decimal(str(data.amount)),
                      method=data.method, notes=data.notes, paid_at=datetime.now(UTC), received_by_id=member.user_id)
    db.add(payment)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Esta cita ya tiene un cobro registrado.") from None
    db.expire(appointment, ["payments"])
    return db.scalar(payment_query(member.clinic_id).where(Payment.id == payment.id))


@router.post("/payments/{payment_id}/void", response_model=PaymentOut)
def void_payment(payment_id: int, data: VoidInput, member: ClinicAdmin, db: Db):
    payment = db.scalar(payment_query(member.clinic_id).where(Payment.id == payment_id).with_for_update(of=Payment))
    if not payment:
        raise HTTPException(404, "No encontramos ese cobro.")
    if payment.voided_at:
        raise HTTPException(409, "Este cobro ya fue anulado.")
    payment.voided_at, payment.voided_by_id, payment.void_reason = datetime.now(UTC), member.user_id, data.reason
    db.commit()
    db.expire(payment.appointment, ["payments"])
    return db.scalar(payment_query(member.clinic_id).where(Payment.id == payment_id))


@router.get("/reports/income", response_model=IncomeReport)
def income_report(member: ClinicAdmin, db: Db, date_from: date | None = None, date_to: date | None = None):
    date_from, date_to = lima_range(date_from, date_to, 29)
    start, end = bounds(date_from, date_to)
    payments = db.scalars(payment_query(member.clinic_id).where(
        Payment.voided_at.is_(None), Payment.paid_at >= start, Payment.paid_at < end)).all()
    by_method = dict.fromkeys(METHODS, 0.0)
    by_day: dict[str, list[float]] = defaultdict(lambda: [0.0, 0])
    by_service: dict[str, list[float]] = defaultdict(lambda: [0.0, 0])
    for p in payments:
        amount = float(p.amount)
        by_method[p.method] += amount
        for bucket, key in ((by_day, p.paid_at.astimezone(LIMA).date().isoformat()), (by_service, p.appointment.service.name)):
            bucket[key][0] += amount
            bucket[key][1] += 1
    pending = pending_payments(member, db)
    statuses = dict(db.execute(select(Appointment.status, func.count()).where(
        Appointment.clinic_id == member.clinic_id, Appointment.starts_at >= start, Appointment.starts_at < end)
        .group_by(Appointment.status)).all())
    total = round(sum(by_method.values()), 2)
    return {
        "average_ticket": round(total / len(payments), 2) if payments else 0.0, "appointments": statuses,
        "date_from": date_from, "date_to": date_to, "count": len(payments),
        "total": total, "by_method": {k: round(v, 2) for k, v in by_method.items()},
        "by_day": [{"key": k, "total": round(v[0], 2), "count": v[1]} for k, v in sorted(by_day.items())],
        "by_service": [{"key": k, "total": round(v[0], 2), "count": v[1]}
                       for k, v in sorted(by_service.items(), key=lambda kv: -kv[1][0])],
        "pending": {"key": "Por cobrar", "count": len(pending),
                    "total": round(sum(float(a.service.price) for a in pending), 2)},
    }


# ---- Inventory ------------------------------------------------------------------------------

def clinic_item(db, member, item_id: int, lock: bool = False) -> InventoryItem:
    query = select(InventoryItem).where(InventoryItem.id == item_id, InventoryItem.clinic_id == member.clinic_id)
    item = db.scalar(query.with_for_update() if lock else query)
    if not item:
        raise HTTPException(404, "No encontramos ese producto en tu inventario.")
    return item


def save_item(db, item: InventoryItem) -> InventoryItem:
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Tu inventario ya tiene un producto con ese nombre.") from None
    return item


@router.get("/inventory", response_model=list[InventoryItemOut])
def list_inventory(member: Staff, db: Db, active_only: bool = False):
    query = select(InventoryItem).where(InventoryItem.clinic_id == member.clinic_id)
    if active_only:
        query = query.where(InventoryItem.is_active.is_(True))
    return db.scalars(query.order_by(InventoryItem.is_active.desc(), InventoryItem.category, InventoryItem.name)).all()


@router.post("/inventory", response_model=InventoryItemOut, status_code=201)
def create_item(data: InventoryCreate, member: ClinicAdmin, db: Db):
    item = InventoryItem(clinic_id=member.clinic_id, stock=data.initial_stock,
                         **data.model_dump(exclude={"initial_stock"}))
    db.add(item)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Tu inventario ya tiene un producto con ese nombre.") from None
    if data.initial_stock:
        db.add(InventoryMovement(item_id=item.id, clinic_id=member.clinic_id, kind="Ingreso",
                                 quantity=data.initial_stock, notes="Stock inicial", user_id=member.user_id))
    return save_item(db, item)


@router.put("/inventory/{item_id}", response_model=InventoryItemOut)
def update_item(item_id: int, data: InventoryUpdate, member: ClinicAdmin, db: Db):
    item = clinic_item(db, member, item_id, lock=True)
    for key, value in data.model_dump().items():
        setattr(item, key, value)
    return save_item(db, item)


@router.post("/inventory/{item_id}/movements", response_model=InventoryItemOut, status_code=201)
def add_movement(item_id: int, data: MovementInput, member: ClinicAdmin, db: Db):
    item = clinic_item(db, member, item_id, lock=True)
    if item.stock + data.quantity < 0:
        raise HTTPException(409, f"El stock de {item.name} quedaría negativo (hay {item.stock}).")
    item.stock += data.quantity
    db.add(InventoryMovement(item_id=item.id, clinic_id=member.clinic_id, user_id=member.user_id,
                             **data.model_dump()))
    db.commit()
    return item


@router.get("/inventory/{item_id}/movements", response_model=list[MovementOut])
def list_movements(item_id: int, member: ClinicAdmin, db: Db):
    item = clinic_item(db, member, item_id)
    return db.scalars(select(InventoryMovement).where(InventoryMovement.item_id == item.id)
                      .options(selectinload(InventoryMovement.user).selectinload(User.profile))
                      .order_by(InventoryMovement.created_at.desc(), InventoryMovement.id.desc()).limit(300)).all()
