from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Timestamps:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class User(Timestamps, Base):
    __tablename__ = "users"
    __table_args__ = (CheckConstraint("email = lower(email)", name="ck_user_email_normalized"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    token_version: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    profile: Mapped["OwnerProfile"] = relationship(back_populates="user", uselist=False)


class OwnerProfile(Timestamps, Base):
    __tablename__ = "owner_profiles"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), unique=True)
    first_name: Mapped[str] = mapped_column(String(80))
    last_name: Mapped[str] = mapped_column(String(80))
    phone: Mapped[str] = mapped_column(String(25))
    user: Mapped[User] = relationship(back_populates="profile")


class Pet(Timestamps, Base):
    __tablename__ = "pets"
    __table_args__ = (
        UniqueConstraint("id", "owner_id", name="uq_pet_owner"),
        CheckConstraint("weight > 0 AND weight <= 1000", name="ck_pet_weight"),
        CheckConstraint("sex IN ('Macho','Hembra')", name="ck_pet_sex"),
        CheckConstraint("species IN ('Perro','Gato','Ave','Conejo','Otro')", name="ck_pet_species"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("owner_profiles.id", ondelete="RESTRICT"), index=True)
    name: Mapped[str] = mapped_column(String(80))
    species: Mapped[str] = mapped_column(String(20))
    breed: Mapped[str] = mapped_column(String(80))
    sex: Mapped[str] = mapped_column(String(10))
    birth_date: Mapped[date] = mapped_column(Date)
    weight: Mapped[Decimal] = mapped_column(Numeric(7, 2))
    color: Mapped[str] = mapped_column(String(80))
    notes: Mapped[str] = mapped_column(Text, default="", server_default="")
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class VeterinaryClinic(Timestamps, Base):
    __tablename__ = "veterinary_clinics"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    address: Mapped[str] = mapped_column(String(250))
    phone: Mapped[str] = mapped_column(String(25))
    opening_hours: Mapped[str] = mapped_column(String(150))
    description: Mapped[str] = mapped_column(Text)


class VeterinaryService(Timestamps, Base):
    __tablename__ = "veterinary_services"
    __table_args__ = (
        UniqueConstraint("id", "clinic_id", name="uq_service_clinic"),
        UniqueConstraint("clinic_id", "name", name="uq_clinic_service_name"),
        CheckConstraint("duration_minutes > 0", name="ck_service_duration"),
        CheckConstraint("price >= 0", name="ck_service_price"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    clinic_id: Mapped[int] = mapped_column(ForeignKey("veterinary_clinics.id", ondelete="RESTRICT"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text)
    duration_minutes: Mapped[int] = mapped_column(Integer)
    price: Mapped[Decimal] = mapped_column(Numeric(8, 2))


class Appointment(Timestamps, Base):
    __tablename__ = "appointments"
    __table_args__ = (
        ForeignKeyConstraint(["pet_id", "owner_id"], ["pets.id", "pets.owner_id"], ondelete="RESTRICT"),
        ForeignKeyConstraint(["service_id", "clinic_id"], ["veterinary_services.id", "veterinary_services.clinic_id"], ondelete="RESTRICT"),
        CheckConstraint("status IN ('Pendiente','Cancelada')", name="ck_appointment_status"),
        Index("ix_appointments_owner_status_start", "owner_id", "status", "starts_at"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("owner_profiles.id", ondelete="RESTRICT"))
    pet_id: Mapped[int] = mapped_column(Integer, index=True)
    clinic_id: Mapped[int] = mapped_column(ForeignKey("veterinary_clinics.id", ondelete="RESTRICT"))
    service_id: Mapped[int] = mapped_column(Integer, index=True)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    reason: Mapped[str] = mapped_column(Text, default="", server_default="")
    status: Mapped[str] = mapped_column(String(12), default="Pendiente", server_default="Pendiente")
    pet: Mapped[Pet] = relationship(foreign_keys=[pet_id, owner_id], viewonly=True)
    clinic: Mapped[VeterinaryClinic] = relationship(foreign_keys=[clinic_id], viewonly=True)
    service: Mapped[VeterinaryService] = relationship(foreign_keys=[service_id, clinic_id], viewonly=True)
