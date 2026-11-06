"""Mobile Bearer sessions, slot availability, waiting room, payments and inventory."""

from datetime import date, datetime, time
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models import Appointment, Pet
from tests.test_owner_flow import (
    PASSWORD,
    PET,
    authenticated,
    lima_today,
    make_appointment,
    register,
    slot,
)
from tests.test_roles import STAFF_PASSWORD, booked, signed_in, team  # noqa: F401  (fixtures)

LIMA = ZoneInfo("America/Lima")


def bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def mobile_token(email="ana@example.com", password=PASSWORD):
    with TestClient(app) as anonymous:
        return anonymous.post("/api/auth/token", json={"email": email, "password": password})


# ---- Bearer sessions --------------------------------------------------------------------------

def test_owner_mobile_token_works_without_cookie_and_logout_revokes_it(client, catalog):
    assert register(client).status_code == 201
    issued = mobile_token()
    assert issued.status_code == 200
    body = issued.json()
    assert body["token_type"] == "bearer" and body["expires_in"] == 30 * 24 * 3600
    assert body["user"]["role"] == "owner"
    assert "set-cookie" not in issued.headers
    with TestClient(app) as phone:
        headers = bearer(body["access_token"])
        assert phone.get("/api/auth/me", headers=headers).json()["email"] == "ana@example.com"
        # Native apps send no Origin; a Bearer request is not subject to the cookie CSRF guard.
        created = phone.post("/api/pets", json=PET, headers=headers | {"Origin": "http://localhost:8081"})
        assert created.status_code == 201
        assert phone.get("/api/pets").status_code == 401  # no cookie, no header
        assert phone.get("/api/auth/me", headers=bearer("not-a-token")).status_code == 401
        assert phone.post("/api/auth/logout", headers=headers).status_code == 204
        assert phone.get("/api/auth/me", headers=headers).status_code == 401


def test_staff_cannot_get_mobile_token(team):  # noqa: F811
    denied = mobile_token("recep@a.pe", STAFF_PASSWORD)
    assert denied.status_code == 403
    assert "propietarios" in denied.json()["error"]["message"]
    assert mobile_token("ana@example.com", "wrong-password").status_code == 401


# ---- Availability -----------------------------------------------------------------------------

def test_slots_follow_hours_and_capacity(client, catalog):
    first, _, service = catalog
    authenticated(client)
    day = datetime.fromisoformat(slot(3)).date()
    slots = client.get(f"/api/clinics/{first.id}/availability", params={"service_id": service.id, "date": day.isoformat()})
    assert slots.status_code == 200
    times = [s["starts_at"] for s in slots.json()["slots"]]
    # 09:00 to 17:30 for a 30-minute service closing at 18:00.
    assert len(times) == 18 and times[0].endswith("09:00:00-05:00") and times[-1].endswith("17:30:00-05:00")
    assert make_appointment(client, catalog, starts_at=slot(3, 10)).status_code == 201
    after = client.get(f"/api/clinics/{first.id}/availability", params={"service_id": service.id, "date": day.isoformat()})
    taken = {s["starts_at"][11:16]: s["available"] for s in after.json()["slots"]}
    assert taken["10:00"] is False and taken["10:30"] is True
    # No vets on the team yet: capacity is one appointment at a time.
    assert make_appointment(client, catalog, starts_at=slot(3, 10)).status_code == 409
    assert make_appointment(client, catalog, starts_at=slot(3, 7)).status_code == 422
    assert make_appointment(client, catalog, starts_at=slot(3, 17, 45)).status_code == 422
    sunday = date.fromordinal(day.toordinal() + (7 - day.isoweekday()))
    closed = client.get(f"/api/clinics/{first.id}/availability", params={"service_id": service.id, "date": sunday.isoformat()})
    assert closed.json()["slots"] == []
    assert make_appointment(client, catalog, starts_at=datetime.combine(sunday, time(10), LIMA).isoformat()).status_code == 422


def test_vet_cannot_be_double_booked(client, team, catalog):  # noqa: F811
    authenticated(client)
    first = make_appointment(client, catalog, starts_at=slot(4, 11)).json()
    # Two vets would allow two requests; clinic A has one vet, so the second request is refused.
    assert make_appointment(client, catalog, starts_at=slot(4, 11)).status_code == 409
    second = make_appointment(client, catalog, starts_at=slot(4, 12)).json()
    with signed_in("recep@a.pe") as recep:
        ok = recep.patch(f"/api/clinic/appointments/{first['id']}", json={"status": "Confirmada", "vet_id": team["vet_id"]})
        assert ok.status_code == 200
        clash = recep.patch(f"/api/clinic/appointments/{second['id']}", json={"starts_at": slot(4, 11)})
        assert clash.status_code == 409
        staff_slots = recep.get("/api/clinic/availability", params={
            "service_id": catalog[2].id, "date": slot(4)[:10], "vet_id": team["vet_id"],
            "exclude_appointment_id": second["id"]}).json()["slots"]
        assert {s["starts_at"][11:16]: s["available"] for s in staff_slots}["11:00"] is False


# ---- Waiting room, payments and inventory -----------------------------------------------------

@pytest.fixture()
def today_visit(db, team, booked):  # noqa: F811
    """A confirmed appointment earlier today (inserted directly: it may already be past)."""
    pet = db.get(Pet, booked["pet"]["id"])
    visit = Appointment(owner_id=pet.owner_id, pet_id=pet.id, clinic_id=booked["clinic"]["id"],
                        service_id=booked["service"]["id"], status="Confirmada", vet_id=team["vet_id"],
                        starts_at=datetime.combine(datetime.now(LIMA).date(), time(9), LIMA))
    db.add(visit)
    db.commit()
    return visit.id


def test_waiting_room_keeps_the_status_cycle(client, today_visit):
    url = f"/api/clinic/appointments/{today_visit}"
    assert client.get(f"/api/appointments/{today_visit}").json()["stage"] == "Confirmada"
    with signed_in("vet@a.pe") as vet:
        assert vet.post(f"{url}/start").status_code == 409  # has not arrived
        assert vet.post(f"{url}/arrival").status_code == 403  # front desk only
    with signed_in("recep@a.pe") as recep:
        arrived = recep.post(f"{url}/arrival")
        assert arrived.status_code == 200
        assert arrived.json()["status"] == "Confirmada" and arrived.json()["stage"] == "En sala de espera"
        assert recep.post(f"{url}/arrival").status_code == 409
        assert recep.patch(url, json={"status": "No asistió"}).status_code == 409
        assert recep.get("/api/clinic/summary").json()["waiting"] == 1
    assert client.patch(f"/api/appointments/{today_visit}/cancel").status_code == 409
    assert client.get(f"/api/appointments/{today_visit}").json()["stage"] == "En sala de espera"
    with signed_in("admin@a.pe") as admin:
        started = admin.post(f"{url}/start")
        assert started.status_code == 200 and started.json()["stage"] == "En consulta"
        assert admin.post(f"{url}/start").status_code == 409
    assert client.get(f"/api/appointments/{today_visit}").json()["stage"] == "En consulta"


def test_payments_and_income_report(client, today_visit, booked):  # noqa: F811
    pet_id = booked["pet"]["id"]
    with signed_in("vet@a.pe") as vet:
        attended = vet.post(f"/api/clinic/patients/{pet_id}/records", json={
            "appointment_id": today_visit, "reason": "Control", "diagnosis": "Paciente sano"})
        assert attended.status_code == 201
        assert vet.get("/api/clinic/payments/pending").status_code == 403
    with signed_in("recep@a.pe") as recep:
        assert [a["id"] for a in recep.get("/api/clinic/payments/pending").json()] == [today_visit]
        assert recep.post("/api/clinic/payments", json={"appointment_id": booked["id"], "amount": 65, "method": "Yape"}).status_code == 409
        assert recep.post("/api/clinic/payments", json={"appointment_id": today_visit, "amount": 65, "method": "Bitcoin"}).status_code == 422
        paid = recep.post("/api/clinic/payments", json={"appointment_id": today_visit, "amount": 65, "method": "Yape"})
        assert paid.status_code == 201 and paid.json()["pet_name"] == "Luna" and paid.json()["owner_name"] == "Ana Torres"
        assert recep.post("/api/clinic/payments", json={"appointment_id": today_visit, "amount": 65, "method": "Efectivo"}).status_code == 409
        assert recep.get("/api/clinic/payments/pending").json() == []
        assert len(recep.get("/api/clinic/payments").json()) == 1
        assert recep.get("/api/clinic/reports/income").status_code == 403
        assert recep.post(f"/api/clinic/payments/{paid.json()['id']}/void", json={"reason": "Error"}).status_code == 403
    assert client.get(f"/api/appointments/{today_visit}").json()["payment"]["method"] == "Yape"
    with signed_in("admin@a.pe") as admin:
        report = admin.get("/api/clinic/reports/income").json()
        assert report["total"] == 65 and report["by_method"]["Yape"] == 65 and report["count"] == 1
        assert report["by_service"][0]["key"] == "Consulta de prueba" and report["pending"]["count"] == 0
        assert report["average_ticket"] == 65 and report["appointments"]["Atendida"] == 1
        voided = admin.post(f"/api/clinic/payments/{paid.json()['id']}/void", json={"reason": "Cobro duplicado"})
        assert voided.status_code == 200 and voided.json()["void_reason"] == "Cobro duplicado"
        assert admin.get("/api/clinic/reports/income").json()["total"] == 0
        again = admin.post("/api/clinic/payments", json={"appointment_id": today_visit, "amount": 60, "method": "Efectivo"})
        assert again.status_code == 201
    assert client.get(f"/api/appointments/{today_visit}").json()["payment"]["amount"] == 60


def test_inventory_is_discounted_by_care(client, team, booked):  # noqa: F811
    pet_id = booked["pet"]["id"]
    today = lima_today().isoformat()
    vaccine = {"kind": "Vacuna", "name": "Antirrábica", "applied_on": today}
    with signed_in("recep@a.pe") as recep:
        assert recep.post("/api/clinic/inventory", json={"name": "Antirrábica", "category": "Vacuna", "unit": "dosis"}).status_code == 403
    with signed_in("admin@a.pe") as admin:
        item = admin.post("/api/clinic/inventory", json={"name": "Antirrábica", "category": "Vacuna", "unit": "dosis",
                                                         "min_stock": 2, "initial_stock": 1})
        assert item.status_code == 201 and item.json()["low_stock"] is True
        item_id = item.json()["id"]
        assert admin.post("/api/clinic/inventory", json={"name": "Antirrábica", "category": "Vacuna", "unit": "dosis"}).status_code == 409
    with signed_in("vet@a.pe") as vet:
        assert vet.get("/api/clinic/inventory").json()[0]["stock"] == 1
        used = vet.post(f"/api/clinic/patients/{pet_id}/care", json=vaccine | {"inventory_item_id": item_id})
        assert used.status_code == 201
        empty = vet.post(f"/api/clinic/patients/{pet_id}/care", json=vaccine | {"inventory_item_id": item_id})
        assert empty.status_code == 409 and "stock" in empty.json()["error"]["message"]
    with signed_in("vet@b.pe") as foreign:
        assert foreign.get("/api/clinic/inventory").json() == []
    with signed_in("admin@a.pe") as admin:
        assert admin.get("/api/clinic/inventory").json()[0]["stock"] == 0
        assert admin.post(f"/api/clinic/inventory/{item_id}/movements", json={"kind": "Ajuste", "quantity": -1}).status_code == 409
        assert admin.post(f"/api/clinic/inventory/{item_id}/movements", json={"kind": "Ingreso", "quantity": -3}).status_code == 422
        restocked = admin.post(f"/api/clinic/inventory/{item_id}/movements", json={"kind": "Ingreso", "quantity": 10, "notes": "Compra"})
        assert restocked.status_code == 201 and restocked.json()["stock"] == 10 and restocked.json()["low_stock"] is False
        kinds = [m["kind"] for m in admin.get(f"/api/clinic/inventory/{item_id}/movements").json()]
        assert kinds == ["Ingreso", "Uso en atención", "Ingreso"]
