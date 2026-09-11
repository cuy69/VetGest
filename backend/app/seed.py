"""Idempotent demonstration catalog. Never creates owner accounts or passwords."""

from decimal import Decimal

from sqlalchemy import select, text

from app.core.database import SessionLocal
from app.models import VeterinaryClinic, VeterinaryService

CLINICS = [
    ("VetGest Miraflores", "Av. de la Salud 245, Miraflores, Lima", "01 555 0101",
     "Lunes a sábado, 08:00–20:00", "Atención cercana para perros y gatos. Un equipo dedicado a acompañarte en cada etapa de su vida."),
    ("Huella Animal", "Calle Los Olivos 180, San Borja, Lima", "01 555 0102",
     "Lunes a sábado, 09:00–19:00", "Consultas preventivas, orientación nutricional y cuidados con tiempo para escuchar tus dudas."),
    ("Casa Mascota", "Av. Los Jardines 620, Surco, Lima", "01 555 0103",
     "Lunes a viernes, 08:00–18:00; sábado, 09:00–13:00", "Un espacio tranquilo para la salud de tus compañeros, con atención general y controles periódicos."),
]
SERVICES = [
    ("Consulta general", "Evaluación física y orientación sobre el bienestar de tu mascota.", 30, "65.00"),
    ("Vacunación", "Evaluación previa y aplicación de la vacuna indicada por el profesional. Precio según vacuna.", 20, "55.00"),
    ("Desparasitación", "Evaluación y elección de un antiparasitario según especie, edad y peso.", 20, "35.00"),
    ("Control", "Revisión de la evolución y recomendaciones de cuidado para tu mascota.", 20, "40.00"),
]


def seed():
    with SessionLocal.begin() as db:
        # Serialize concurrent startup seeds without overwriting existing catalog edits.
        db.execute(text("SELECT pg_advisory_xact_lock(71001)"))
        for name, address, phone, hours, description in CLINICS:
            clinic = db.scalar(select(VeterinaryClinic).where(VeterinaryClinic.name == name))
            if not clinic:
                clinic = VeterinaryClinic(name=name, address=address, phone=phone,
                                          opening_hours=hours, description=description)
                db.add(clinic)
                db.flush()
            for service_name, detail, minutes, price in SERVICES:
                exists = db.scalar(select(VeterinaryService.id).where(
                    VeterinaryService.clinic_id == clinic.id, VeterinaryService.name == service_name))
                if not exists:
                    db.add(VeterinaryService(clinic_id=clinic.id, name=service_name,
                                             description=detail, duration_minutes=minutes,
                                             price=Decimal(price)))
    print("Catálogo de demostración disponible: 3 veterinarias y 12 servicios.")


if __name__ == "__main__":
    seed()
