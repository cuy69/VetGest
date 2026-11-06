"""Multi-clinic roles, appointment workflow and clinical history."""

import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

OLD_STATUSES = "status IN ('Pendiente','Cancelada')"
NEW_STATUSES = "status IN ('Pendiente', 'Confirmada', 'Atendida', 'Cancelada', 'No asistió')"


def timestamps():
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    ]


def touch(table: str):
    op.execute(f"CREATE TRIGGER touch_updated_at BEFORE UPDATE ON {table} FOR EACH ROW EXECUTE FUNCTION vetgest_touch_updated_at()")


def upgrade():
    # Personal data now belongs to every account type, not only owners.
    op.rename_table("owner_profiles", "profiles")
    op.execute("ALTER INDEX owner_profiles_pkey RENAME TO profiles_pkey")
    op.execute("ALTER TABLE profiles RENAME CONSTRAINT owner_profiles_user_id_key TO profiles_user_id_key")
    op.execute("ALTER TABLE profiles RENAME CONSTRAINT owner_profiles_user_id_fkey TO profiles_user_id_fkey")
    op.execute("ALTER SEQUENCE owner_profiles_id_seq RENAME TO profiles_id_seq")

    op.add_column("users", sa.Column("role", sa.String(20), nullable=False, server_default="owner"))
    op.add_column("users", sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()))
    op.add_column("users", sa.Column("must_change_password", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.create_check_constraint("ck_user_role", "users", "role IN ('owner', 'staff', 'platform_admin')")

    op.add_column("veterinary_clinics", sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()))
    op.add_column("veterinary_services", sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()))

    op.create_table("clinic_members",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, unique=True),
        sa.Column("clinic_id", sa.Integer(), sa.ForeignKey("veterinary_clinics.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("role", sa.String(20), nullable=False),
        sa.CheckConstraint("role IN ('admin', 'vet', 'reception')", name="ck_member_role"),
        *timestamps())
    op.create_index("ix_clinic_members_clinic_id", "clinic_members", ["clinic_id"])

    op.drop_constraint("ck_appointment_status", "appointments", type_="check")
    op.create_check_constraint("ck_appointment_status", "appointments", NEW_STATUSES)
    op.add_column("appointments", sa.Column("vet_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="RESTRICT")))
    op.add_column("appointments", sa.Column("staff_notes", sa.Text(), nullable=False, server_default=""))
    op.create_index("ix_appointments_vet_id", "appointments", ["vet_id"])
    op.create_index("ix_appointments_clinic_start", "appointments", ["clinic_id", "starts_at"])

    op.create_table("medical_records",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("pet_id", sa.Integer(), sa.ForeignKey("pets.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("clinic_id", sa.Integer(), sa.ForeignKey("veterinary_clinics.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("vet_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("appointment_id", sa.Integer(), sa.ForeignKey("appointments.id", ondelete="RESTRICT"), unique=True),
        sa.Column("attended_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("diagnosis", sa.Text(), nullable=False),
        sa.Column("indications", sa.Text(), nullable=False, server_default=""),
        sa.Column("weight", sa.Numeric(7, 2)),
        sa.Column("next_visit_on", sa.Date()),
        *timestamps())
    op.create_index("ix_medical_records_pet_id", "medical_records", ["pet_id"])

    op.create_table("care_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("pet_id", sa.Integer(), sa.ForeignKey("pets.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("clinic_id", sa.Integer(), sa.ForeignKey("veterinary_clinics.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("vet_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("record_id", sa.Integer(), sa.ForeignKey("medical_records.id", ondelete="RESTRICT")),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("dose", sa.String(120), nullable=False, server_default=""),
        sa.Column("applied_on", sa.Date(), nullable=False),
        sa.Column("next_due_on", sa.Date()),
        sa.Column("notes", sa.Text(), nullable=False, server_default=""),
        sa.CheckConstraint("kind IN ('Vacuna', 'Desparasitación', 'Tratamiento')", name="ck_care_kind"),
        sa.CheckConstraint("next_due_on IS NULL OR next_due_on >= applied_on", name="ck_care_next_due"),
        *timestamps())
    op.create_index("ix_care_events_pet_due", "care_events", ["pet_id", "next_due_on"])
    op.create_index("ix_care_events_record_id", "care_events", ["record_id"])

    for table in ("clinic_members", "medical_records", "care_events"):
        touch(table)


def downgrade():
    for table in ("care_events", "medical_records", "clinic_members"):
        op.drop_table(table)
    op.drop_index("ix_appointments_clinic_start", "appointments")
    op.drop_index("ix_appointments_vet_id", "appointments")
    op.drop_column("appointments", "staff_notes")
    op.drop_column("appointments", "vet_id")
    # Lossy by necessity: the old schema only knew pending and cancelled requests.
    op.execute("UPDATE appointments SET status = 'Pendiente' WHERE status = 'Confirmada'")
    op.execute("UPDATE appointments SET status = 'Cancelada' WHERE status NOT IN ('Pendiente', 'Cancelada')")
    op.drop_constraint("ck_appointment_status", "appointments", type_="check")
    op.create_check_constraint("ck_appointment_status", "appointments", OLD_STATUSES)
    op.drop_column("veterinary_services", "is_active")
    op.drop_column("veterinary_clinics", "is_active")
    op.drop_constraint("ck_user_role", "users", type_="check")
    for column in ("must_change_password", "is_active", "role"):
        op.drop_column("users", column)
    op.execute("ALTER SEQUENCE profiles_id_seq RENAME TO owner_profiles_id_seq")
    op.execute("ALTER TABLE profiles RENAME CONSTRAINT profiles_user_id_fkey TO owner_profiles_user_id_fkey")
    op.execute("ALTER TABLE profiles RENAME CONSTRAINT profiles_user_id_key TO owner_profiles_user_id_key")
    op.execute("ALTER INDEX profiles_pkey RENAME TO owner_profiles_pkey")
    op.rename_table("profiles", "owner_profiles")
