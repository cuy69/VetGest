from datetime import timedelta

import pytest
from fastapi.testclient import TestClient

from app.core.security import password_hash
from app.main import app
from app.models import ClinicMember, Profile, User
from tests.test_owner_flow import PASSWORD, authenticated, lima_today, make_appointment, slot

STAFF_PASSWORD = "Staff-password-123"


def make_user(db, email, role="staff", clinic=None, clinic_role=None, must_change=False):
    user = User(email=email, password_hash=password_hash.hash(STAFF_PASSWORD), role=role, must_change_password=must_change)
    user.profile = Profile(first_name=email.split("@")[0].title(), last_name="Prueba", phone="987000111")
    db.add(user)
    db.flush()
    if clinic is not None:
        db.add(ClinicMember(user_id=user.id, clinic_id=clinic.id, role=clinic_role))
    db.commit()
    return user


def signed_in(email):
    client = TestClient(app)
    assert client.post("/api/auth/login", json={"email": email, "password": STAFF_PASSWORD}).status_code == 200
    return client


@pytest.fixture()
def team(db, catalog):
    first, second, _ = catalog
    make_user(db, "admin@a.pe", clinic=first, clinic_role="admin")
    vet = make_user(db, "vet@a.pe", clinic=first, clinic_role="vet")
    make_user(db, "recep@a.pe", clinic=first, clinic_role="reception")
    make_user(db, "vet@b.pe", clinic=second, clinic_role="vet")
    make_user(db, "root@vetgest.pe", role="platform_admin")
    return {"vet_id": vet.id}


@pytest.fixture()
def booked(client, catalog):
    authenticated(client)
    created = make_appointment(client, catalog)
    assert created.status_code == 201
    return created.json()


def test_me_exposes_role_and_membership(team):
    with signed_in("recep@a.pe") as recep:
        me = recep.get("/api/auth/me").json()
        assert me["role"] == "staff"
        assert me["membership"]["role"] == "reception"
        assert me["membership"]["clinic_name"] == "Clínica de prueba A"


def test_role_boundaries(client, team, booked):
    with signed_in("vet@a.pe") as vet:
        assert vet.get("/api/pets").status_code == 403
        assert vet.get("/api/admin/clinics").status_code == 403
        assert vet.patch(f"/api/clinic/appointments/{booked['id']}", json={"status": "Confirmada"}).status_code == 403
        assert vet.post("/api/clinic/staff", json={}).status_code in (403, 422)
    assert client.get("/api/clinic/appointments").status_code == 403
    assert client.get("/api/admin/summary").status_code == 403
    with signed_in("root@vetgest.pe") as root:
        assert root.get("/api/clinic/appointments").status_code == 403
        assert root.get("/api/admin/summary").json()["owners"] >= 1


def test_front_desk_workflow_and_clinic_isolation(team, booked):
    appointment_id = booked["id"]
    with signed_in("recep@a.pe") as recep:
        agenda = recep.get("/api/clinic/appointments").json()
        assert [a["id"] for a in agenda] == [appointment_id]
        assert agenda[0]["owner"]["first_name"] == "Ana"
        assert recep.patch(f"/api/clinic/appointments/{appointment_id}", json={"status": "Atendida"}).status_code == 422
        assert recep.patch(f"/api/clinic/appointments/{appointment_id}", json={"status": "No asistió"}).status_code == 409
        result = recep.patch(f"/api/clinic/appointments/{appointment_id}", json={"status": "Confirmada", "vet_id": team["vet_id"]})
        assert result.status_code == 200
        assert result.json()["status"] == "Confirmada" and result.json()["vet"]["id"] == team["vet_id"]
        new_time = slot(5)
        assert recep.patch(f"/api/clinic/appointments/{appointment_id}", json={"starts_at": new_time}).status_code == 200
        # A vet from another clinic cannot be assigned.
        other_vet = recep.get("/api/clinic/staff").json()
        assert all(s["email"] != "vet@b.pe" for s in other_vet)
    with signed_in("vet@b.pe") as foreign:
        assert foreign.get("/api/clinic/appointments").json() == []
        assert foreign.get(f"/api/clinic/appointments/{appointment_id}").status_code == 404
        assert foreign.get(f"/api/clinic/patients/{booked['pet']['id']}").status_code == 404


def test_vet_records_attention_and_owner_sees_history_and_reminders(client, team, booked):
    pet_id = booked["pet"]["id"]
    due = (lima_today() + timedelta(days=10)).isoformat()
    with signed_in("vet@a.pe") as vet:
        assert [p["id"] for p in vet.get("/api/clinic/patients", params={"search": "lun"}).json()] == [pet_id]
        record = vet.post(f"/api/clinic/patients/{pet_id}/records", json={
            "appointment_id": booked["id"], "reason": "Control anual", "diagnosis": "Paciente sano",
            "weight": 4.7, "next_visit_on": None,
            "care": [{"kind": "Vacuna", "name": "Triple felina", "applied_on": lima_today().isoformat(), "next_due_on": due}],
        })
        assert record.status_code == 201, record.text
        assert record.json()["vet"]["profile"]["first_name"] == "Vet"
        again = vet.post(f"/api/clinic/patients/{pet_id}/records", json={"appointment_id": booked["id"], "reason": "x" * 3, "diagnosis": "y" * 3})
        assert again.status_code == 409
        bad = {"kind": "Vacuna", "name": "Rabia", "applied_on": lima_today().isoformat(), "next_due_on": "2000-01-01"}
        assert vet.post(f"/api/clinic/patients/{pet_id}/care", json=bad).status_code == 422
    appointment = client.get(f"/api/appointments/{booked['id']}").json()
    assert appointment["status"] == "Atendida" and appointment["has_record"] is True
    assert client.patch(f"/api/appointments/{booked['id']}/cancel").status_code == 409
    history = client.get(f"/api/pets/{pet_id}/history").json()
    assert history["records"][0]["diagnosis"] == "Paciente sano"
    assert history["care"][0]["name"] == "Triple felina"
    assert client.get(f"/api/pets/{pet_id}").json()["weight"] == 4.7
    reminders = client.get("/api/reminders").json()
    assert any(r["kind"] == "Vacuna" and r["due"] == due and not r["overdue"] for r in reminders)
    with signed_in("recep@a.pe") as recep:
        assert recep.post(f"/api/clinic/patients/{pet_id}/care", json=bad | {"next_due_on": due}).status_code == 403


def test_newer_dose_supersedes_reminder(client, team, booked):
    pet_id = booked["pet"]["id"]
    old = {"kind": "Desparasitación", "name": "Interna", "applied_on": (lima_today() - timedelta(days=120)).isoformat(),
           "next_due_on": (lima_today() - timedelta(days=30)).isoformat()}
    with signed_in("vet@a.pe") as vet:
        assert vet.post(f"/api/clinic/patients/{pet_id}/care", json=old).status_code == 201
        assert any(r["overdue"] for r in client.get("/api/reminders").json())
        new = old | {"applied_on": lima_today().isoformat(), "next_due_on": (lima_today() + timedelta(days=90)).isoformat()}
        assert vet.post(f"/api/clinic/patients/{pet_id}/care", json=new).status_code == 201
    assert not [r for r in client.get("/api/reminders").json() if r["kind"] == "Desparasitación"]


def test_clinic_admin_manages_team_and_services(db, team):
    with signed_in("admin@a.pe") as admin:
        created = admin.post("/api/clinic/staff", json={"first_name": "Rosa", "last_name": "Díaz", "phone": "987111222",
                                                        "email": "rosa@a.pe", "role": "reception", "temporary_password": "Temporal-1234"})
        assert created.status_code == 201
        rosa_id = created.json()["user_id"]
        me_id = admin.get("/api/auth/me").json()["id"]
        assert admin.patch(f"/api/clinic/staff/{me_id}", json={"role": "vet", "is_active": True}).status_code == 409
        service = admin.post("/api/clinic/services", json={"name": "Baño medicado", "description": "Higiene", "duration_minutes": 45, "price": 50})
        assert service.status_code == 201
        retired = admin.put(f"/api/clinic/services/{service.json()['id']}", json={
            "name": "Baño medicado", "description": "Higiene", "duration_minutes": 45, "price": 50, "is_active": False})
        assert retired.json()["is_active"] is False
        assert admin.get("/api/services", params={"clinic_id": service.json()["clinic_id"]}).json()[0]["name"] != "Baño medicado"
    rosa = TestClient(app)
    login = rosa.post("/api/auth/login", json={"email": "rosa@a.pe", "password": "Temporal-1234"})
    assert login.json()["must_change_password"] is True
    changed = rosa.post("/api/auth/password", json={"current_password": "Temporal-1234", "new_password": "Definitiva-5678"})
    assert changed.status_code == 200 and changed.json()["must_change_password"] is False
    assert rosa.get("/api/auth/me").status_code == 200
    with signed_in("admin@a.pe") as admin:
        assert admin.patch(f"/api/clinic/staff/{rosa_id}", json={"role": "reception", "is_active": False}).status_code == 200
    assert rosa.get("/api/auth/me").status_code == 401
    assert rosa.post("/api/auth/login", json={"email": "rosa@a.pe", "password": "Definitiva-5678"}).status_code == 403
    rosa.close()


def test_platform_admin_onboards_and_suspends_clinic(client, team):
    with signed_in("root@vetgest.pe") as root:
        payload = {"name": "Clínica Nueva", "address": "Av. Pardo 123, Chimbote", "phone": "043 555 000",
                   "opening_hours": "Lunes a sábado 9:00–18:00", "description": "Atención integral de mascotas.",
                   "admin": {"first_name": "Luis", "last_name": "Rojas", "phone": "987333444",
                             "email": "luis@nueva.pe", "temporary_password": "Temporal-1234"}}
        created = root.post("/api/admin/clinics", json=payload)
        assert created.status_code == 201 and created.json()["staff_count"] == 1
        assert root.post("/api/admin/clinics", json=payload).status_code == 409
        clinic_id = created.json()["id"]
        luis = TestClient(app)
        assert luis.post("/api/auth/login", json={"email": "luis@nueva.pe", "password": "Temporal-1234"}).json()["membership"]["role"] == "admin"
        assert root.patch(f"/api/admin/clinics/{clinic_id}/status", json={"is_active": False}).json()["is_active"] is False
        assert luis.get("/api/auth/me").status_code == 401
        luis.close()
    authenticated(client, "owner2@example.com")
    assert all(c["id"] != clinic_id for c in client.get("/api/clinics").json())
    assert client.get(f"/api/clinics/{clinic_id}").status_code == 404


def test_public_signup_cannot_escalate_role(client):
    data = {"first_name": "Eva", "last_name": "Mal", "email": "eva@example.com", "phone": "987654321",
            "password": PASSWORD, "password_confirmation": PASSWORD, "role": "platform_admin"}
    assert client.post("/api/auth/register", json=data).status_code == 422
