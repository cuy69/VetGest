"""Mobile-ready clinic operations: hours, waiting room, payments and inventory."""

import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def timestamps():
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    ]


def touch(table: str):
    op.execute(f"CREATE TRIGGER touch_updated_at BEFORE UPDATE ON {table} FOR EACH ROW EXECUTE FUNCTION vetgest_touch_updated_at()")


def upgrade():
    op.add_column("veterinary_clinics", sa.Column("opens_at", sa.Time(), nullable=False, server_default="09:00"))
    op.add_column("veterinary_clinics", sa.Column("closes_at", sa.Time(), nullable=False, server_default="18:00"))
    op.add_column("veterinary_clinics", sa.Column("open_days", sa.String(7), nullable=False, server_default="123456"))
    op.create_check_constraint("ck_clinic_hours", "veterinary_clinics", "closes_at > opens_at")
    op.create_check_constraint("ck_clinic_open_days", "veterinary_clinics", "open_days ~ '^[1-7]{1,7}$'")

    op.add_column("appointments", sa.Column("arrived_at", sa.DateTime(timezone=True)))
    op.add_column("appointments", sa.Column("started_at", sa.DateTime(timezone=True)))
    op.create_check_constraint("ck_appointment_started_after_arrival", "appointments",
                               "started_at IS NULL OR arrived_at IS NOT NULL")

    op.create_table("payments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("clinic_id", sa.Integer(), sa.ForeignKey("veterinary_clinics.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("appointment_id", sa.Integer(), sa.ForeignKey("appointments.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("amount", sa.Numeric(8, 2), nullable=False),
        sa.Column("method", sa.String(10), nullable=False),
        sa.Column("notes", sa.Text(), nullable=False, server_default=""),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("received_by_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("voided_at", sa.DateTime(timezone=True)),
        sa.Column("voided_by_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="RESTRICT")),
        sa.Column("void_reason", sa.Text()),
        sa.CheckConstraint("method IN ('Efectivo', 'Yape', 'Tarjeta')", name="ck_payment_method"),
        sa.CheckConstraint("amount >= 0", name="ck_payment_amount"),
        sa.CheckConstraint("(voided_at IS NULL) = (void_reason IS NULL)", name="ck_payment_void"),
        *timestamps())
    op.create_index("uq_payment_appointment_valid", "payments", ["appointment_id"], unique=True,
                    postgresql_where=sa.text("voided_at IS NULL"))
    op.create_index("ix_payments_clinic_paid", "payments", ["clinic_id", "paid_at"])

    op.create_table("inventory_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("clinic_id", sa.Integer(), sa.ForeignKey("veterinary_clinics.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("category", sa.String(20), nullable=False),
        sa.Column("unit", sa.String(30), nullable=False),
        sa.Column("stock", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("min_stock", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.UniqueConstraint("clinic_id", "name", name="uq_inventory_clinic_name"),
        sa.CheckConstraint("category IN ('Vacuna', 'Antiparasitario', 'Medicamento', 'Insumo')", name="ck_inventory_category"),
        sa.CheckConstraint("stock >= 0", name="ck_inventory_stock"),
        sa.CheckConstraint("min_stock >= 0", name="ck_inventory_min_stock"),
        *timestamps())
    op.create_index("ix_inventory_items_clinic_id", "inventory_items", ["clinic_id"])

    op.add_column("care_events", sa.Column("inventory_item_id", sa.Integer(),
                                           sa.ForeignKey("inventory_items.id", ondelete="RESTRICT")))

    op.create_table("inventory_movements",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("item_id", sa.Integer(), sa.ForeignKey("inventory_items.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("clinic_id", sa.Integer(), sa.ForeignKey("veterinary_clinics.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=False, server_default=""),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("care_event_id", sa.Integer(), sa.ForeignKey("care_events.id", ondelete="RESTRICT")),
        sa.CheckConstraint("kind IN ('Ingreso', 'Ajuste', 'Uso en atención')", name="ck_movement_kind"),
        sa.CheckConstraint("quantity <> 0", name="ck_movement_quantity"),
        *timestamps())
    op.create_index("ix_inventory_movements_item_id", "inventory_movements", ["item_id"])

    for table in ("payments", "inventory_items", "inventory_movements"):
        touch(table)


def downgrade():
    op.drop_table("inventory_movements")
    op.drop_column("care_events", "inventory_item_id")
    op.drop_table("inventory_items")
    op.drop_table("payments")
    op.drop_constraint("ck_appointment_started_after_arrival", "appointments", type_="check")
    op.drop_column("appointments", "started_at")
    op.drop_column("appointments", "arrived_at")
    op.drop_constraint("ck_clinic_open_days", "veterinary_clinics", type_="check")
    op.drop_constraint("ck_clinic_hours", "veterinary_clinics", type_="check")
    for column in ("open_days", "closes_at", "opens_at"):
        op.drop_column("veterinary_clinics", column)
