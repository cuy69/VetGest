from datetime import date, datetime, time
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


class PasswordInput(Input):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=10, max_length=128)


class MembershipOut(Output):
    clinic_id: int
    clinic_name: str
    role: Literal["admin", "vet", "reception"]


class UserOut(Output):
    id: int
    email: str
    role: Literal["owner", "staff", "platform_admin"]
    must_change_password: bool
    profile: ProfileOut
    membership: MembershipOut | None = None

    @model_validator(mode="before")
    @classmethod
    def flatten_membership(cls, value):
        member = getattr(value, "membership", None)
        if member is not None and not isinstance(value, dict):
            return {"id": value.id, "email": value.email, "role": value.role,
                    "must_change_password": value.must_change_password, "profile": value.profile,
                    "membership": {"clinic_id": member.clinic_id, "clinic_name": member.clinic.name, "role": member.role}}
        return value


class TokenOut(BaseModel):
    access_token: str
    token_type: Literal["bearer"]
    expires_in: int
    user: UserOut


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


Weekday = Annotated[int, Field(ge=1, le=7)]


class ClinicOut(Output):
    id: int
    name: str
    address: str
    phone: str
    opening_hours: str
    description: str
    opens_at: time
    closes_at: time
    open_days: list[int]

    @field_validator("open_days", mode="before")
    @classmethod
    def split_days(cls, value):
        return [int(d) for d in value] if isinstance(value, str) else value

    @field_validator("opens_at", "closes_at", mode="after")
    @classmethod
    def minutes_only(cls, value: time):
        return value.replace(second=0, microsecond=0)


class ServiceOut(Output):
    id: int
    clinic_id: int
    name: str
    description: str
    duration_minutes: int
    price: float
    is_active: bool


class ClinicInput(Input):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=120)]
    address: Annotated[str, StringConstraints(strip_whitespace=True, min_length=5, max_length=250)]
    phone: Phone
    opening_hours: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=150)]
    description: Annotated[str, StringConstraints(strip_whitespace=True, min_length=10, max_length=2000)]
    opens_at: time = time(9)
    closes_at: time = time(18)
    open_days: list[Weekday] = Field(default_factory=lambda: [1, 2, 3, 4, 5, 6], min_length=1, max_length=7)

    @model_validator(mode="after")
    def coherent_hours(self):
        if self.closes_at <= self.opens_at:
            raise ValueError("La hora de cierre debe ser posterior a la de apertura.")
        self.open_days = sorted(set(self.open_days))
        return self

    def columns(self) -> dict:
        data = self.model_dump()
        data["open_days"] = "".join(str(d) for d in self.open_days)
        return data


class ServiceInput(Input):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=120)]
    description: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=2000)]
    duration_minutes: int = Field(ge=5, le=600)
    price: float = Field(ge=0, le=100000, multiple_of=0.01, allow_inf_nan=False)
    is_active: bool = True


class StaffInput(ProfileInput):
    email: EmailStr = Field(max_length=254)
    role: Literal["admin", "vet", "reception"]
    temporary_password: str = Field(min_length=10, max_length=128)


class StaffUpdate(Input):
    role: Literal["admin", "vet", "reception"]
    is_active: bool


class StaffOut(Output):
    user_id: int
    email: str
    role: Literal["admin", "vet", "reception"]
    is_active: bool
    profile: ProfileOut

    @model_validator(mode="before")
    @classmethod
    def from_member(cls, value):
        if not isinstance(value, dict):
            return {"user_id": value.user_id, "email": value.user.email, "role": value.role,
                    "is_active": value.user.is_active, "profile": value.user.profile}
        return value


class ClinicAdminInput(ProfileInput):
    email: EmailStr = Field(max_length=254)
    temporary_password: str = Field(min_length=10, max_length=128)


class ClinicCreate(ClinicInput):
    admin: ClinicAdminInput


class ClinicStatusInput(Input):
    is_active: bool


class AdminClinicOut(ClinicOut):
    is_active: bool
    staff_count: int = 0
    appointment_count: int = 0


class StaffName(Output):
    id: int
    profile: ProfileOut


class AppointmentInput(Input):
    pet_id: int = Field(gt=0)
    clinic_id: int = Field(gt=0)
    service_id: int = Field(gt=0)
    starts_at: AwareDatetime
    reason: str = Field(default="", max_length=2000)


AppointmentStatus = Literal["Pendiente", "Confirmada", "Atendida", "Cancelada", "No asistió"]
AppointmentStage = Literal["Por confirmar", "Confirmada", "En sala de espera", "En consulta", "Atendida",
                           "Cancelada", "No asistió"]
PaymentMethod = Literal["Efectivo", "Yape", "Tarjeta"]


class PaymentSummary(Output):
    id: int
    amount: float
    method: PaymentMethod
    paid_at: datetime


class AppointmentOut(Output):
    id: int
    pet: PetOut
    clinic: ClinicOut
    service: ServiceOut
    starts_at: datetime
    reason: str
    status: AppointmentStatus
    vet: StaffName | None = None
    has_record: bool = False
    arrived_at: datetime | None = None
    started_at: datetime | None = None
    stage: AppointmentStage
    payment: PaymentSummary | None = None
    created_at: datetime
    updated_at: datetime


class OwnerContact(Output):
    first_name: str
    last_name: str
    phone: str


class ClinicAppointmentOut(AppointmentOut):
    owner: OwnerContact
    staff_notes: str


class AppointmentManage(Input):
    """Front-desk changes. Omitted fields stay unchanged."""
    status: Literal["Confirmada", "Cancelada", "No asistió"] | None = None
    vet_id: int | None = Field(default=None, gt=0)
    starts_at: AwareDatetime | None = None
    staff_notes: str | None = Field(default=None, max_length=2000)


class CareInput(Input):
    kind: Literal["Vacuna", "Desparasitación", "Tratamiento"]
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=120)]
    dose: str = Field(default="", max_length=120)
    applied_on: date
    next_due_on: date | None = None
    notes: str = Field(default="", max_length=2000)
    # Optional stock item used in this care event (one unit is discounted).
    inventory_item_id: int | None = Field(default=None, gt=0)

    @model_validator(mode="after")
    def coherent_dates(self):
        if self.applied_on > datetime.now(ZoneInfo("America/Lima")).date():
            raise ValueError("La fecha de aplicación no puede estar en el futuro.")
        if self.next_due_on and self.next_due_on < self.applied_on:
            raise ValueError("La próxima fecha debe ser posterior a la aplicación.")
        return self


class RecordInput(Input):
    appointment_id: int | None = Field(default=None, gt=0)
    reason: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=2000)]
    diagnosis: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=4000)]
    indications: str = Field(default="", max_length=4000)
    weight: float | None = Field(default=None, ge=0.01, le=1000, multiple_of=0.01, allow_inf_nan=False)
    next_visit_on: date | None = None
    care: list[CareInput] = Field(default_factory=list, max_length=10)


class ClinicName(Output):
    id: int
    name: str


class CareOut(Output):
    id: int
    kind: str
    name: str
    dose: str
    applied_on: date
    next_due_on: date | None
    notes: str
    clinic: ClinicName
    vet: StaffName


class RecordOut(Output):
    id: int
    pet_id: int
    appointment_id: int | None
    attended_at: datetime
    reason: str
    diagnosis: str
    indications: str
    weight: float | None
    next_visit_on: date | None
    clinic: ClinicName
    vet: StaffName


class HistoryOut(BaseModel):
    records: list[RecordOut]
    care: list[CareOut]


class PatientOut(PetOut):
    owner: OwnerContact


class Reminder(BaseModel):
    kind: Literal["Vacuna", "Desparasitación", "Tratamiento", "Control", "Cita"]
    title: str
    pet_id: int
    pet_name: str
    due: date
    overdue: bool
    clinic_name: str


class Slot(BaseModel):
    starts_at: datetime
    available: bool


class AvailabilityOut(BaseModel):
    date: date
    slots: list[Slot]


class PaymentInput(Input):
    appointment_id: int = Field(gt=0)
    amount: float = Field(ge=0, le=100000, multiple_of=0.01, allow_inf_nan=False)
    method: PaymentMethod
    notes: str = Field(default="", max_length=500)


class VoidInput(Input):
    reason: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=500)]


class PaymentOut(Output):
    id: int
    appointment_id: int
    amount: float
    method: PaymentMethod
    notes: str
    paid_at: datetime
    received_by: StaffName
    pet_name: str
    owner_name: str
    service_name: str
    voided_at: datetime | None
    void_reason: str | None

    @model_validator(mode="before")
    @classmethod
    def flatten(cls, value):
        if isinstance(value, dict):
            return value
        a = value.appointment
        return {**{k: getattr(value, k) for k in ("id", "appointment_id", "amount", "method", "notes", "paid_at",
                                                  "received_by", "voided_at", "void_reason")},
                "pet_name": a.pet.name, "service_name": a.service.name,
                "owner_name": f"{a.owner.first_name} {a.owner.last_name}"}


class MoneyByKey(BaseModel):
    key: str
    total: float
    count: int


class IncomeReport(BaseModel):
    date_from: date
    date_to: date
    total: float
    count: int
    by_method: dict[str, float]
    by_day: list[MoneyByKey]
    by_service: list[MoneyByKey]
    pending: MoneyByKey
    average_ticket: float
    # Appointments scheduled in the period, by status (no-show rate = "No asistió" / total).
    appointments: dict[str, int]


InventoryCategory = Literal["Vacuna", "Antiparasitario", "Medicamento", "Insumo"]
ItemName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=120)]
Unit = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=30)]


class InventoryUpdate(Input):
    name: ItemName
    category: InventoryCategory
    unit: Unit
    min_stock: int = Field(ge=0, le=100000)
    is_active: bool = True


class InventoryCreate(Input):
    name: ItemName
    category: InventoryCategory
    unit: Unit
    min_stock: int = Field(default=0, ge=0, le=100000)
    initial_stock: int = Field(default=0, ge=0, le=100000)


class InventoryItemOut(Output):
    id: int
    name: str
    category: InventoryCategory
    unit: str
    stock: int
    min_stock: int
    is_active: bool
    low_stock: bool


class MovementInput(Input):
    kind: Literal["Ingreso", "Ajuste"]
    quantity: int = Field(ge=-100000, le=100000)
    notes: str = Field(default="", max_length=500)

    @model_validator(mode="after")
    def valid_quantity(self):
        if self.quantity == 0 or (self.kind == "Ingreso" and self.quantity < 0):
            raise ValueError("Un ingreso debe ser positivo y un ajuste distinto de cero.")
        return self


class MovementOut(Output):
    id: int
    kind: str
    quantity: int
    notes: str
    created_at: datetime
    user: StaffName
    care_event_id: int | None
