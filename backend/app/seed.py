"""Idempotent demonstration catalog and optional platform-admin bootstrap.

Never creates owner accounts or hard-coded passwords: the administrator comes from
BOOTSTRAP_ADMIN_EMAIL / BOOTSTRAP_ADMIN_PASSWORD and must change it on first sign-in.
"""

from datetime import time
from decimal import Decimal

from sqlalchemy import select, text

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.core.security import password_hash
from app.models import InventoryItem, Profile, User, VeterinaryClinic, VeterinaryService

CLINICS = [
    ("VetGest Miraflores", "Av. de la Salud 245, Miraflores, Lima", "01 555 0101",
     "Lunes a sábado, 08:00–20:00", "Atención cercana para perros y gatos. Un equipo dedicado a acompañarte en cada etapa de su vida."),
    ("Huella Animal", "Calle Los Olivos 180, San Borja, Lima", "01 555 0102",
     "Lunes a sábado, 09:00–19:00", "Consultas preventivas, orientación nutricional y cuidados con tiempo para escuchar tus dudas."),
    ("Casa Mascota", "Av. Los Jardines 620, Surco, Lima", "01 555 0103",
     "Lunes a viernes, 08:00–18:00; sábado, 09:00–13:00", "Un espacio tranquilo para la salud de tus compañeros, con atención general y controles periódicos."),
]
# Structured hours for slot availability: (opens, closes, ISO weekdays).
HOURS = {
    "VetGest Miraflores": (time(8), time(20), "123456"),
    "Huella Animal": (time(9), time(19), "123456"),
    "Casa Mascota": (time(8), time(18), "12345"),
}
# Demo stock only; real clinics register their own products.
INVENTORY = [
    ("Vacuna antirrábica", "Vacuna", "dosis", 10, 12),
    ("Vacuna séxtuple canina", "Vacuna", "dosis", 10, 15),
    ("Vacuna triple felina", "Vacuna", "dosis", 6, 8),
    ("Antiparasitario oral perros 10–20 kg", "Antiparasitario", "tabletas", 5, 20),
    ("Pipeta antipulgas gatos", "Antiparasitario", "unidades", 8, 10),
]
SERVICES = [
    ("Consulta general", "Evaluación física y orientación sobre el bienestar de tu mascota.", 30, "65.00"),
    ("Vacunación", "Evaluación previa y aplicación de la vacuna indicada por el profesional. Precio según vacuna.", 20, "55.00"),
    ("Desparasitación", "Evaluación y elección de un antiparasitario según especie, edad y peso.", 20, "35.00"),
    ("Control", "Revisión de la evolución y recomendaciones de cuidado para tu mascota.", 20, "40.00"),
]


def seed():
    lock_down_data_api()
    grant_app_role()
    if get_settings().seed_demo_catalog:
        seed_catalog()
    bootstrap_admin()


def lock_down_data_api():
    """Supabase publishes the public schema through its Data API using public keys.

    VetGest only talks to PostgreSQL through the backend (which connects as the table
    owner), so every table gets RLS with no policies and loses anon/authenticated grants.
    Runs on every start so tables added by future migrations are covered too.
    """
    with SessionLocal.begin() as db:
        roles = set(db.scalars(text("SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')")))
        if not roles:
            return  # Plain PostgreSQL (local, CI): nothing to lock down.
        tables = db.scalars(text("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")).all()
        grantees = ", ".join(sorted(roles))
        for table in tables:
            db.execute(text(f'ALTER TABLE public."{table}" ENABLE ROW LEVEL SECURITY'))
            db.execute(text(f'REVOKE ALL ON TABLE public."{table}" FROM {grantees}'))
        db.execute(text(f"REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM {grantees}"))
        db.execute(text(f"REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM {grantees}"))
    print(f"Data API bloqueada para {grantees} en {len(tables)} tablas.")


APP_ROLE = "vetgest_app"


def grant_app_role():
    """Least privilege for the running API (docs/administracion-bd.md). If the role exists,
    it gets read/insert/update on the data but no DELETE, TRUNCATE or DDL: clinical records
    are never hard-deleted, and a compromised API cannot drop or empty tables. Migrations and
    this seed keep running as the owner (MIGRATION_DATABASE_URL). Idempotent, so tables from
    future migrations are covered on the next start.
    """
    with SessionLocal.begin() as db:
        if not db.scalar(text("SELECT 1 FROM pg_roles WHERE rolname = :role"), {"role": APP_ROLE}):
            return
        db.execute(text(f"GRANT USAGE ON SCHEMA public TO {APP_ROLE}"))
        db.execute(text(f"GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO {APP_ROLE}"))
        db.execute(text(f"REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM {APP_ROLE}"))
        db.execute(text(f"REVOKE INSERT, UPDATE ON public.alembic_version FROM {APP_ROLE}"))
        db.execute(text(f"GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO {APP_ROLE}"))
        # RLS (enabled by lock_down_data_api on Supabase) hides every row from non-owners without a policy.
        tables = db.scalars(text(
            "SELECT tablename FROM pg_tables t WHERE schemaname = 'public' AND tablename <> 'alembic_version' "
            "AND NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' "
            "AND p.tablename = t.tablename AND p.policyname = 'vetgest_app_access')")).all()
        for table in tables:
            db.execute(text(f'CREATE POLICY vetgest_app_access ON public."{table}" TO {APP_ROLE} USING (true) WITH CHECK (true)'))
    print(f"Permisos mínimos aplicados a {APP_ROLE}.")


def seed_catalog():
    with SessionLocal.begin() as db:
        # Serialize concurrent startup seeds without overwriting existing catalog edits.
        db.execute(text("SELECT pg_advisory_xact_lock(71001)"))
        for name, address, phone, hours, description in CLINICS:
            clinic = db.scalar(select(VeterinaryClinic).where(VeterinaryClinic.name == name))
            if not clinic:
                opens, closes, days = HOURS[name]
                clinic = VeterinaryClinic(name=name, address=address, phone=phone, opening_hours=hours,
                                          description=description, opens_at=opens, closes_at=closes, open_days=days)
                db.add(clinic)
                db.flush()
            if not db.scalar(select(InventoryItem.id).where(InventoryItem.clinic_id == clinic.id).limit(1)):
                # Opening balance without a movement: movements need the staff member who made them.
                db.add_all(InventoryItem(clinic_id=clinic.id, name=item_name, category=category, unit=unit,
                                         min_stock=minimum, stock=stock)
                           for item_name, category, unit, minimum, stock in INVENTORY)
            for service_name, detail, minutes, price in SERVICES:
                exists = db.scalar(select(VeterinaryService.id).where(
                    VeterinaryService.clinic_id == clinic.id, VeterinaryService.name == service_name))
                if not exists:
                    db.add(VeterinaryService(clinic_id=clinic.id, name=service_name,
                                             description=detail, duration_minutes=minutes,
                                             price=Decimal(price)))
    print("Catálogo de demostración disponible: 3 veterinarias, 12 servicios e inventario inicial.")


def bootstrap_admin():
    settings = get_settings()
    if not settings.bootstrap_admin_email or not settings.bootstrap_admin_password:
        return
    email = str(settings.bootstrap_admin_email).lower()
    with SessionLocal.begin() as db:
        db.execute(text("SELECT pg_advisory_xact_lock(71002)"))
        if db.scalar(select(User.id).where(User.email == email)):
            return
        user = User(email=email, password_hash=password_hash.hash(settings.bootstrap_admin_password),
                    role="platform_admin", must_change_password=True)
        user.profile = Profile(first_name="Administración", last_name="VetGest", phone="000000000")
        db.add(user)
    print("Administrador de plataforma creado; debe cambiar su contraseña al ingresar.")


if __name__ == "__main__":
    seed()
