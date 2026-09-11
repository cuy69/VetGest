import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

# Tests only use a dedicated PostgreSQL database, migrated before pytest starts.
os.environ.setdefault("POSTGRES_PASSWORD", "isolated-test-password")
os.environ.setdefault("JWT_SECRET", "isolated-test-secret-not-for-production-123456789")
os.environ.setdefault("CORS_ORIGINS", '["http://testserver"]')

from app.core.database import get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models import VeterinaryClinic, VeterinaryService  # noqa: E402


@pytest.fixture(scope="session")
def test_engine():
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.fail("Set TEST_DATABASE_URL to a migrated PostgreSQL database ending in _test.")
    parsed = make_url(url)
    if parsed.get_backend_name() != "postgresql" or not (parsed.database or "").endswith("_test"):
        pytest.fail("Refusing to run tests outside a dedicated PostgreSQL *_test database.")
    engine = create_engine(url, pool_pre_ping=True)
    yield engine
    engine.dispose()


@pytest.fixture()
def db(test_engine):
    connection = test_engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection, join_transaction_mode="create_savepoint", expire_on_commit=False)
    app.dependency_overrides[get_db] = lambda: session
    yield session
    app.dependency_overrides.clear()
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture()
def client(db):
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def catalog(db):
    first = VeterinaryClinic(name="Clínica de prueba A", address="Lima", phone="1234567", opening_hours="09:00–18:00", description="Atención de prueba")
    second = VeterinaryClinic(name="Clínica de prueba B", address="Lima", phone="1234568", opening_hours="09:00–18:00", description="Atención de prueba")
    db.add_all([first, second])
    db.flush()
    service = VeterinaryService(clinic_id=first.id, name="Consulta de prueba", description="Evaluación", duration_minutes=30, price=65)
    db.add(service)
    db.commit()
    return first, second, service
