from datetime import date, datetime
from typing import Annotated, Literal
from zoneinfo import ZoneInfo

from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    StringConstraints,
    field_validator,
    model_validator,
)

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
Phone = Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^\+?[0-9 ()-]{7,25}$")]


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Output(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class ProfileInput(Input):
    first_name: Name
    last_name: Name
    phone: Phone


class RegisterInput(ProfileInput):
    email: EmailStr = Field(max_length=254)
    password: str = Field(min_length=10, max_length=128)
    password_confirmation: str = Field(min_length=10, max_length=128)

    @model_validator(mode="after")
    def matching_passwords(self):
        if self.password != self.password_confirmation:
            raise ValueError("Las contraseñas no coinciden.")
        return self


class LoginInput(Input):
    email: EmailStr = Field(max_length=254)
    password: str = Field(min_length=1, max_length=128)


class ProfileOut(Output):
    first_name: str
    last_name: str
    phone: str


class UserOut(Output):
    id: int
    email: str
    profile: ProfileOut


class PetInput(Input):
    name: Name
    species: Literal["Perro", "Gato", "Ave", "Conejo", "Otro"]
    breed: Name
    sex: Literal["Macho", "Hembra"]
    birth_date: date
    weight: float = Field(ge=0.01, le=1000, multiple_of=0.01, allow_inf_nan=False)
    color: Name
    notes: str = Field(default="", max_length=2000)

    @field_validator("birth_date")
    @classmethod
    def valid_birth_date(cls, value: date):
        if value > datetime.now(ZoneInfo("America/Lima")).date():
            raise ValueError("La fecha de nacimiento no puede estar en el futuro.")
        if value < date(1900, 1, 1):
            raise ValueError("La fecha debe ser posterior al año 1900.")
        return value


class PetOut(PetInput, Output):
    id: int
    created_at: datetime
    updated_at: datetime


class ClinicOut(Output):
    id: int
    name: str
    address: str
    phone: str
    opening_hours: str
    description: str


class ServiceOut(Output):
    id: int
    clinic_id: int
    name: str
    description: str
    duration_minutes: int
    price: float


class AppointmentInput(Input):
    pet_id: int = Field(gt=0)
    clinic_id: int = Field(gt=0)
    service_id: int = Field(gt=0)
    starts_at: AwareDatetime
    reason: str = Field(default="", max_length=2000)


class AppointmentOut(Output):
    id: int
    pet: PetOut
    clinic: ClinicOut
    service: ServiceOut
    starts_at: datetime
    reason: str
    status: Literal["Pendiente", "Cancelada"]
    created_at: datetime
    updated_at: datetime
