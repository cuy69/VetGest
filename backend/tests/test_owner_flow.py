from datetime import UTC, datetime, timedelta

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.config import get_settings
from app.core.security import password_hash
from app.main import app
from app.models import User

PASSWORD = "Test-password-123"
PET = {"name": "Luna", "species": "Gato", "breed": "Mestizo", "sex": "Hembra", "birth_date": "2022-03-12", "weight": 4.5, "color": "Gris", "notes": "Es tranquila."}


def register(client, email="ana@example.com"):
    return client.post("/api/auth/register", json={"first_name": "Ana", "last_name": "Torres", "email": email, "phone": "987654321", "password": PASSWORD, "password_confirmation": PASSWORD})


def login(client, email="ana@example.com"):
    return client.post("/api/auth/login", json={"email": email, "password": PASSWORD})


def authenticated(client, email="ana@example.com"):
    assert register(client, email).status_code == 201
    assert login(client, email).status_code == 200


def make_appointment(client, catalog, **overrides):
    first, _, service = catalog
    pet = client.post("/api/pets", json=PET)
    assert pet.status_code == 201
    data = {"pet_id": pet.json()["id"], "clinic_id": first.id, "service_id": service.id,
            "starts_at": (datetime.now(UTC) + timedelta(days=2)).isoformat(), "reason": "Control preventivo"}
    return client.post("/api/appointments", json=data | overrides)


def test_registration_hash_unique_email_and_no_automatic_login(client, db):
    result = register(client, "Ana@Example.com")
    assert result.status_code == 201
    assert result.json()["email"] == "ana@example.com"
    assert "password_hash" not in result.text and "token_version" not in result.text
    user = db.scalar(select(User).where(User.email == "ana@example.com"))
    assert user.password_hash != PASSWORD
    assert user.password_hash.startswith("$argon2id$")
    assert password_hash.verify(PASSWORD, user.password_hash)
    assert register(client).status_code == 409
    assert client.get("/api/auth/me").status_code == 401


def test_registration_validation_does_not_echo_password(client):
    result = client.post("/api/auth/register", json={"first_name": "Ana", "last_name": "Torres", "phone": "987654321", "email": "invalid", "password": "short", "password_confirmation": "mismatch"})
    assert result.status_code == 422
    assert "error" in result.json()
    assert '"short"' not in result.text and '"mismatch"' not in result.text


def test_login_correct_incorrect_and_logout_revokes_token(client):
    authenticated(client)
    assert client.get("/api/auth/me").status_code == 200
    token = client.cookies.get("vetgest_session")
    result = client.post("/api/auth/login", json={"email": "ana@example.com", "password": "wrong"})
    assert result.status_code == 401
    assert client.post("/api/auth/logout").status_code == 204
    assert client.get("/api/auth/me").status_code == 401
    client.cookies.set("vetgest_session", token, path="/api")
    assert client.get("/api/auth/me").status_code == 401


def test_cookie_flags_and_profile_update(client):
    register(client)
    result = login(client)
    cookie = result.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=lax" in cookie and "path=/api" in cookie
    update = client.patch("/api/auth/profile", json={"first_name": "Ana María", "last_name": "Torres", "phone": "+51 987654321"})
    assert update.status_code == 200
    assert client.get("/api/auth/me").json()["profile"]["first_name"] == "Ana María"
    assert client.patch("/api/auth/profile", json={"first_name": "Ana", "last_name": "Torres", "phone": "987654321", "user_id": 999}).status_code == 422


@pytest.mark.parametrize("path", ["/api/auth/me", "/api/pets", "/api/pets/1", "/api/appointments", "/api/appointments/1", "/api/clinics", "/api/services"])
def test_private_routes_require_session(client, path):
    assert client.get(path).status_code == 401


def test_invalid_and_expired_jwt(client):
    authenticated(client)
    original = client.cookies.get("vetgest_session")
    client.cookies.clear()
    client.cookies.set("vetgest_session", "forged", path="/api")
    assert client.get("/api/auth/me").status_code == 401
    payload = jwt.decode(original, options={"verify_signature": False})
    payload["exp"] = int((datetime.now(UTC) - timedelta(minutes=2)).timestamp())
    client.cookies.clear()
    client.cookies.set("vetgest_session", jwt.encode(payload, get_settings().jwt_secret, algorithm="HS256"), path="/api")
    assert client.get("/api/auth/me").status_code == 401


def test_pet_crud_and_owner_isolation(client):
    authenticated(client)
    created = client.post("/api/pets", json=PET)
    assert created.status_code == 201
    pet_id = created.json()["id"]
    assert client.get("/api/pets").json()[0]["name"] == "Luna"
    assert client.put(f"/api/pets/{pet_id}", json=PET | {"weight": 4.8}).status_code == 200
    assert client.get(f"/api/pets/{pet_id}").json()["weight"] == 4.8
    with TestClient(app) as other:
        authenticated(other, "other@example.com")
        assert other.get("/api/pets").json() == []
        assert other.get(f"/api/pets/{pet_id}").status_code == 404
        assert other.put(f"/api/pets/{pet_id}", json=PET).status_code == 404
        assert other.delete(f"/api/pets/{pet_id}").status_code == 404
    assert client.delete(f"/api/pets/{pet_id}").status_code == 204
    assert client.get("/api/pets").json() == []
    assert client.get(f"/api/pets/{pet_id}").status_code == 404


@pytest.mark.parametrize("values", [{"weight": 0}, {"weight": -1}, {"weight": 0.001}, {"birth_date": "2999-01-01"}, {"birth_date": "2023-02-30"}, {"name": "   "}, {"species": "Unknown"}, {"owner_id": 1}])
def test_pet_validation(client, values):
    authenticated(client)
    assert client.post("/api/pets", json=PET | values).status_code == 422


def test_appointment_create_detail_cancel_and_foreign_owner(client, catalog):
    authenticated(client)
    created = make_appointment(client, catalog)
    assert created.status_code == 201
    appointment = created.json()
    assert appointment["status"] == "Pendiente"
    appointment_id = appointment["id"]
    pet_id = appointment["pet"]["id"]
    assert client.get(f"/api/appointments/{appointment_id}").json()["pet"]["name"] == "Luna"
    assert len(client.get("/api/appointments").json()) == 1
    assert client.delete(f"/api/pets/{pet_id}").status_code == 409
    with TestClient(app) as other:
        authenticated(other, "other@example.com")
        assert other.get("/api/appointments").json() == []
        assert other.get(f"/api/appointments/{appointment_id}").status_code == 404
        assert other.patch(f"/api/appointments/{appointment_id}/cancel").status_code == 404
        payload = {"pet_id": pet_id, "clinic_id": catalog[0].id, "service_id": catalog[2].id, "starts_at": (datetime.now(UTC) + timedelta(days=3)).isoformat()}
        assert other.post("/api/appointments", json=payload).status_code == 404
    assert client.patch(f"/api/appointments/{appointment_id}/cancel").json()["status"] == "Cancelada"
    assert client.patch(f"/api/appointments/{appointment_id}/cancel").status_code == 409
    assert client.delete(f"/api/pets/{pet_id}").status_code == 204
    assert client.get(f"/api/appointments/{appointment_id}").json()["pet"]["name"] == "Luna"


def test_reject_past_naive_time_wrong_clinic_and_injected_status(client, catalog):
    authenticated(client)
    assert make_appointment(client, catalog, starts_at=(datetime.now(UTC) - timedelta(minutes=1)).isoformat()).status_code == 422
    assert make_appointment(client, catalog, starts_at="2099-01-01T10:00:00").status_code == 422
    assert make_appointment(client, catalog, clinic_id=catalog[1].id).status_code == 422
    assert make_appointment(client, catalog, status="Confirmada").status_code == 422


def test_catalog_search_details_services_and_unknown_id(client, catalog):
    authenticated(client)
    result = client.get("/api/clinics", params={"search": "prueba a"})
    assert result.status_code == 200 and len(result.json()) == 1
    assert client.get(f"/api/clinics/{catalog[0].id}").status_code == 200
    assert len(client.get("/api/services", params={"clinic_id": catalog[0].id}).json()) == 1
    assert client.get("/api/services", params={"clinic_id": catalog[1].id}).json() == []
    assert client.get("/api/clinics/999999").status_code == 404
    assert client.get("/api/clinics", params={"search": "%"}).json() == []


def test_csrf_origin_rejected_and_openapi_available(client):
    assert client.post("/api/auth/login", headers={"Origin": "https://untrusted.example"}, json={"email": "ana@example.com", "password": PASSWORD}).status_code == 403
    schema = client.get("/api/openapi.json")
    assert schema.status_code == 200
    assert "/api/appointments/{appointment_id}/cancel" in schema.json()["paths"]
    assert client.get("/api/docs").status_code == 200
