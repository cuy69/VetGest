from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import CareEvent, MedicalRecord, User


def pet_history(db: Session, pet_id: int) -> dict:
    """Full clinical history of a pet across clinics, newest first."""
    vet = selectinload(MedicalRecord.vet).selectinload(User.profile)
    records = db.scalars(select(MedicalRecord).where(MedicalRecord.pet_id == pet_id)
                         .options(selectinload(MedicalRecord.clinic), vet)
                         .order_by(MedicalRecord.attended_at.desc())).all()
    care = db.scalars(select(CareEvent).where(CareEvent.pet_id == pet_id)
                      .options(selectinload(CareEvent.clinic), selectinload(CareEvent.vet).selectinload(User.profile))
                      .order_by(CareEvent.applied_on.desc(), CareEvent.id.desc())).all()
    return {"records": records, "care": care}
