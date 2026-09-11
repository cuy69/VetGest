import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from starlette.exceptions import HTTPException

from app.core.config import get_settings
from app.core.database import engine
from app.domains import appointments, auth, catalog, pets

settings = get_settings()
app = FastAPI(title="VetGest API", version="1.0.0", docs_url="/api/docs", openapi_url="/api/openapi.json",
              redoc_url=None, description="Sprint 1 · Experiencia del propietario. Inicia sesión en /auth/login para usar la cookie de sesión en Swagger.")
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins,
                   allow_credentials=True, allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
                   allow_headers=["Content-Type"])


@app.middleware("http")
async def security_headers_and_origin(request: Request, call_next):
    origin = request.headers.get("origin")
    if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
        if origin and origin not in settings.cors_origins:
            return JSONResponse(status_code=403, content={"error": {"code": "forbidden_origin", "message": "Origen no permitido."}})
        if request.headers.get("sec-fetch-site") == "cross-site":
            return JSONResponse(status_code=403, content={"error": {"code": "forbidden_origin", "message": "Origen no permitido."}})
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Cache-Control"] = "no-store"
    return response


@app.exception_handler(HTTPException)
async def http_error(request: Request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, headers=exc.headers,
                        content={"error": {"code": str(exc.status_code), "message": str(exc.detail)}})


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError):
    # Never echo input values: they may contain passwords or personal information.
    fields = [{"field": ".".join(str(p) for p in e["loc"][1:]), "type": e["type"]} for e in exc.errors()]
    return JSONResponse(status_code=422, content={"error": {"code": "validation_error",
                        "message": "Revisa los campos obligatorios y los valores ingresados.", "fields": fields}})


@app.exception_handler(SQLAlchemyError)
async def database_error(request: Request, exc: SQLAlchemyError):
    logging.getLogger("vetgest").error("Database operation failed: %s", type(exc).__name__)
    return JSONResponse(status_code=503, content={"error": {"code": "database_unavailable",
                        "message": "No pudimos guardar o consultar los datos. Inténtalo nuevamente."}})


@app.get("/api/health", tags=["Sistema"])
def health():
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    return {"status": "ok", "database": "postgresql"}


for router in (auth.router, pets.router, catalog.router, appointments.router):
    app.include_router(router, prefix="/api")
