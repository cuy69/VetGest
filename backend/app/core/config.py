from functools import lru_cache

from pydantic import EmailStr, Field, ValidationError, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import URL


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=("../.env", ".env"), extra="ignore")
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "vetgest"
    postgres_user: str = "vetgest"
    postgres_password: str | None = None
    # Full URL (e.g. Supabase). Takes precedence over the POSTGRES_* parts.
    database_url: str | None = None
    jwt_secret: str = Field(min_length=32)
    token_minutes: int = Field(default=60, ge=5, le=1440)
    # Bearer tokens for the owner mobile app; revoked by logout or a password change.
    mobile_token_days: int = Field(default=30, ge=1, le=90)
    cookie_secure: bool = False
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:8080"]
    # Optional: creates the first platform administrator on startup if the email is unused.
    # Validated like sign-in emails so the account can actually log in (e.g. rejects .local).
    bootstrap_admin_email: EmailStr | None = None
    bootstrap_admin_password: str | None = Field(default=None, min_length=12)
    # Fictitious clinics for demos; disable in real deployments.
    seed_demo_catalog: bool = True

    @field_validator("database_url")
    @classmethod
    def use_psycopg_driver(cls, value: str | None):
        # Providers hand out postgres:// or postgresql:// URLs; SQLAlchemy needs the driver name.
        for prefix in ("postgres://", "postgresql://"):
            if value and value.startswith(prefix):
                return "postgresql+psycopg://" + value[len(prefix):]
        return value

    @model_validator(mode="after")
    def has_database(self):
        if not self.database_url and not self.postgres_password:
            raise ValueError("Configura DATABASE_URL o POSTGRES_PASSWORD.")
        return self

    @property
    def db_url(self) -> str | URL:
        return self.database_url or URL.create(
            "postgresql+psycopg", username=self.postgres_user,
            password=self.postgres_password, host=self.postgres_host,
            port=self.postgres_port, database=self.postgres_db,
        )


@lru_cache
def get_settings() -> Settings:
    try:
        return Settings()
    except ValidationError as exc:
        # Pydantic echoes the input values, which include secrets (JWT, DB URL, admin password).
        problems = "; ".join(f"{'.'.join(map(str, e['loc'])) or 'config'}: {e['msg']}" for e in exc.errors())
        raise RuntimeError(f"Configuración inválida: {problems}") from None
