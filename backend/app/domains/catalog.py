from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select

from app.core.security import CurrentUser, Db
from app.models import VeterinaryClinic, VeterinaryService
from app.schemas import ClinicOut, ServiceOut

router = APIRouter(tags=["Veterinarias y servicios"])


@router.get("/clinics", response_model=list[ClinicOut])
def list_clinics(user: CurrentUser, db: Db, search: str = Query(default="", max_length=120)):
    query = select(VeterinaryClinic)
    if search.strip():
        query = query.where(VeterinaryClinic.name.icontains(search.strip(), autoescape=True))
    return db.scalars(query.order_by(VeterinaryClinic.name)).all()


@router.get("/clinics/{clinic_id}", response_model=ClinicOut)
def get_clinic(clinic_id: int, user: CurrentUser, db: Db):
    clinic = db.get(VeterinaryClinic, clinic_id)
    if not clinic:
        raise HTTPException(404, "No encontramos esa veterinaria.")
    return clinic


@router.get("/services", response_model=list[ServiceOut])
def list_services(user: CurrentUser, db: Db, clinic_id: int | None = Query(default=None, gt=0)):
    query = select(VeterinaryService)
    if clinic_id is not None:
        query = query.where(VeterinaryService.clinic_id == clinic_id)
    return db.scalars(query.order_by(VeterinaryService.name)).all()
