from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import URL


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=("../.env", ".env"), extra="ignore")
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "vetgest"
    postgres_user: str = "vetgest"
    postgres_password: str
    database_url: str | None = None
    jwt_secret: str = Field(min_length=32)
    token_minutes: int = Field(default=60, ge=5, le=1440)
    cookie_secure: bool = False
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:8080"]

    @property
    def db_url(self) -> str | URL:
        return self.database_url or URL.create(
            "postgresql+psycopg", username=self.postgres_user,
            password=self.postgres_password, host=self.postgres_host,
            port=self.postgres_port, database=self.postgres_db,
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
