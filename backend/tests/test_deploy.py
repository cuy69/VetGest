import pytest
from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError

from app.core.config import Settings
from app.seed import grant_app_role, lock_down_data_api


def test_supabase_data_api_cannot_read_tables(test_engine):
    # Simulate Supabase's API roles with its default grants on the public schema.
    with test_engine.begin() as conn:
        for role in ("anon", "authenticated"):
            conn.execute(text(f"DO $$ BEGIN CREATE ROLE {role} NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$"))
            conn.execute(text(f"GRANT USAGE ON SCHEMA public TO {role}"))
            conn.execute(text(f"GRANT ALL ON ALL TABLES IN SCHEMA public TO {role}"))
    lock_down_data_api()
    with test_engine.connect() as conn:
        rls = conn.scalar(text("SELECT bool_and(rowsecurity) FROM pg_tables WHERE schemaname = 'public'"))
        assert rls is True
        conn.execute(text("SET ROLE anon"))
        with pytest.raises(ProgrammingError):
            conn.execute(text("SELECT password_hash FROM users"))
        conn.rollback()


def test_app_role_reads_and_writes_but_cannot_delete_or_alter(test_engine):
    with test_engine.begin() as conn:
        conn.execute(text("DO $$ BEGIN CREATE ROLE vetgest_app NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$"))
        conn.execute(text("ALTER TABLE veterinary_clinics ENABLE ROW LEVEL SECURITY"))  # as on Supabase
        owner_sees = conn.scalar(text("SELECT count(*) FROM veterinary_clinics"))
    grant_app_role()
    with test_engine.connect() as conn:
        conn.execute(text("SET ROLE vetgest_app"))
        assert conn.scalar(text("SELECT count(*) FROM veterinary_clinics")) == owner_sees  # policy lets rows through
        conn.execute(text("UPDATE veterinary_clinics SET phone = phone"))
        for statement in ("DELETE FROM pets", "TRUNCATE payments", "DROP TABLE pets", "CREATE TABLE intruder (id int)"):
            with pytest.raises(ProgrammingError):
                conn.execute(text(statement))
            conn.rollback()
            conn.execute(text("SET ROLE vetgest_app"))
        conn.rollback()


def test_database_url_normalized_for_psycopg():
    settings = Settings(database_url="postgresql://u:p@db.example.supabase.co:5432/postgres", jwt_secret="x" * 32)
    assert settings.db_url.startswith("postgresql+psycopg://")
    with pytest.raises(ValueError):
        Settings(_env_file=None, jwt_secret="x" * 32, postgres_password=None, database_url=None)


def test_invalid_settings_never_print_secret_values(monkeypatch):
    from app.core.config import get_settings
    monkeypatch.setattr(Settings, "model_config", {**Settings.model_config, "env_file": None})
    for key in ("DATABASE_URL", "POSTGRES_PASSWORD"):
        monkeypatch.delenv(key, raising=False)
    monkeypatch.setenv("JWT_SECRET", "secret-that-must-not-leak-1234567890")
    get_settings.cache_clear()
    try:
        with pytest.raises(RuntimeError) as error:
            get_settings()
        assert "DATABASE_URL" in str(error.value) and "must-not-leak" not in str(error.value)
    finally:
        get_settings.cache_clear()
