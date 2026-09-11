from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.core.security import CurrentUser, Db
from app.models import Appointment, Pet
from app.schemas import PetInput, PetOut

router = APIRouter(prefix="/pets", tags=["Mascotas"])


def owned_pet(db, owner_id: int, pet_id: int, lock: bool = False) -> Pet:
    query = select(Pet).where(Pet.id == pet_id, Pet.owner_id == owner_id, Pet.deleted_at.is_(None))
    pet = db.scalar(query.with_for_update() if lock else query)
    if not pet:
        raise HTTPException(404, "No encontramos esa mascota.")
    return pet


@router.get("", response_model=list[PetOut])
def list_pets(user: CurrentUser, db: Db):
    return db.scalars(select(Pet).where(Pet.owner_id == user.profile.id, Pet.deleted_at.is_(None)).order_by(Pet.created_at.desc())).all()


@router.post("", response_model=PetOut, status_code=201)
def create_pet(data: PetInput, user: CurrentUser, db: Db):
    pet = Pet(owner_id=user.profile.id, **data.model_dump())
    db.add(pet)
    db.commit()
    return pet


@router.get("/{pet_id}", response_model=PetOut)
def get_pet(pet_id: int, user: CurrentUser, db: Db):
    return owned_pet(db, user.profile.id, pet_id)


@router.put("/{pet_id}", response_model=PetOut)
def update_pet(pet_id: int, data: PetInput, user: CurrentUser, db: Db):
    pet = owned_pet(db, user.profile.id, pet_id, lock=True)
    for key, value in data.model_dump().items():
        setattr(pet, key, value)
    db.commit()
    return pet


@router.delete("/{pet_id}", status_code=204)
def delete_pet(pet_id: int, user: CurrentUser, db: Db):
    pet = owned_pet(db, user.profile.id, pet_id, lock=True)
    pending = db.scalar(select(Appointment.id).where(Appointment.pet_id == pet.id, Appointment.status == "Pendiente").limit(1))
    if pending:
        raise HTTPException(409, "Cancela las citas pendientes de esta mascota antes de eliminarla.")
    pet.deleted_at = datetime.now(UTC)
    db.commit()
