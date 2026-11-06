FROM python:3.12-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN useradd --create-home vetgest
COPY --chown=vetgest:vetgest . .
USER vetgest
EXPOSE 8000
# Migrations and seed run as the table owner (MIGRATION_DATABASE_URL, optional); the API itself
# uses DATABASE_URL, which may be the least-privilege role vetgest_app (docs/administracion-bd.md).
CMD ["sh", "-c", "DATABASE_URL=\"${MIGRATION_DATABASE_URL:-$DATABASE_URL}\" alembic upgrade head && DATABASE_URL=\"${MIGRATION_DATABASE_URL:-$DATABASE_URL}\" python -m app.seed && exec uvicorn app.main:app --host 0.0.0.0 --port 8000"]

FROM base AS test
ENV RUFF_CACHE_DIR=/tmp/ruff-cache PYTEST_ADDOPTS="-o cache_dir=/tmp/pytest-cache"
USER root
RUN pip install --no-cache-dir -r requirements-dev.txt
USER vetgest
CMD ["sh", "-c", "alembic upgrade head && python -m app.seed && pytest -q && ruff check ."]

# Last stage = default build target (used by Render). Compose keeps using "base"/"test".
FROM base AS runtime
