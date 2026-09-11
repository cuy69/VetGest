"""Owner experience: accounts, pets, catalog and appointments."""

import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def timestamps():
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    ]


def upgrade():
    op.create_table("users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(254), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("token_version", sa.Integer(), nullable=False, server_default="0"),
        sa.CheckConstraint("email = lower(email)", name="ck_user_email_normalized"),
        *timestamps())
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_table("owner_profiles",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, unique=True),
        sa.Column("first_name", sa.String(80), nullable=False),
        sa.Column("last_name", sa.String(80), nullable=False),
        sa.Column("phone", sa.String(25), nullable=False),
        *timestamps())
    op.create_table("pets",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("owner_id", sa.Integer(), sa.ForeignKey("owner_profiles.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("species", sa.String(20), nullable=False),
        sa.Column("breed", sa.String(80), nullable=False),
        sa.Column("sex", sa.String(10), nullable=False),
        sa.Column("birth_date", sa.Date(), nullable=False),
        sa.Column("weight", sa.Numeric(7, 2), nullable=False),
        sa.Column("color", sa.String(80), nullable=False),
        sa.Column("notes", sa.Text(), nullable=False, server_default=""),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("id", "owner_id", name="uq_pet_owner"),
        sa.CheckConstraint("weight > 0 AND weight <= 1000", name="ck_pet_weight"),
        sa.CheckConstraint("sex IN ('Macho','Hembra')", name="ck_pet_sex"),
        sa.CheckConstraint("species IN ('Perro','Gato','Ave','Conejo','Otro')", name="ck_pet_species"),
        *timestamps())
    op.create_index("ix_pets_owner_id", "pets", ["owner_id"])
    op.create_table("veterinary_clinics",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("address", sa.String(250), nullable=False),
        sa.Column("phone", sa.String(25), nullable=False),
        sa.Column("opening_hours", sa.String(150), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        *timestamps())
    op.create_index("ix_veterinary_clinics_name", "veterinary_clinics", ["name"], unique=True)
    op.create_table("veterinary_services",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("clinic_id", sa.Integer(), sa.ForeignKey("veterinary_clinics.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False),
        sa.Column("price", sa.Numeric(8, 2), nullable=False),
        sa.UniqueConstraint("id", "clinic_id", name="uq_service_clinic"),
        sa.UniqueConstraint("clinic_id", "name", name="uq_clinic_service_name"),
        sa.CheckConstraint("duration_minutes > 0", name="ck_service_duration"),
        sa.CheckConstraint("price >= 0", name="ck_service_price"),
        *timestamps())
    op.create_index("ix_veterinary_services_clinic_id", "veterinary_services", ["clinic_id"])
    op.create_table("appointments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("owner_id", sa.Integer(), sa.ForeignKey("owner_profiles.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("pet_id", sa.Integer(), nullable=False),
        sa.Column("clinic_id", sa.Integer(), sa.ForeignKey("veterinary_clinics.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("service_id", sa.Integer(), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False, server_default=""),
        sa.Column("status", sa.String(12), nullable=False, server_default="Pendiente"),
        sa.ForeignKeyConstraint(["pet_id", "owner_id"], ["pets.id", "pets.owner_id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["service_id", "clinic_id"], ["veterinary_services.id", "veterinary_services.clinic_id"], ondelete="RESTRICT"),
        sa.CheckConstraint("status IN ('Pendiente','Cancelada')", name="ck_appointment_status"),
        *timestamps())
    op.create_index("ix_appointments_owner_status_start", "appointments", ["owner_id", "status", "starts_at"])
    op.create_index("ix_appointments_pet_id", "appointments", ["pet_id"])
    op.create_index("ix_appointments_service_id", "appointments", ["service_id"])
    # Keep audit timestamps correct even for updates issued outside SQLAlchemy.
    op.execute("""CREATE FUNCTION vetgest_touch_updated_at() RETURNS trigger AS $$
        BEGIN NEW.updated_at = CURRENT_TIMESTAMP; RETURN NEW; END;
        $$ LANGUAGE plpgsql""")
    for table in ("users", "owner_profiles", "pets", "veterinary_clinics", "veterinary_services", "appointments"):
        op.execute(f"CREATE TRIGGER touch_updated_at BEFORE UPDATE ON {table} FOR EACH ROW EXECUTE FUNCTION vetgest_touch_updated_at()")


def downgrade():
    for table in ("appointments", "veterinary_services", "veterinary_clinics", "pets", "owner_profiles", "users"):
        op.drop_table(table)
    op.execute("DROP FUNCTION vetgest_touch_updated_at()")
