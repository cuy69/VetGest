from datetime import UTC, datetime, timedelta
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import APIKeyCookie, HTTPAuthorizationCredentials, HTTPBearer
from pwdlib import PasswordHash
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.models import ClinicMember, User

password_hash = PasswordHash.recommended()
dummy_hash = password_hash.hash("dummy-password-never-used-to-log-in")
cookie_scheme = APIKeyCookie(name="vetgest_session", auto_error=False)
# The mobile app cannot rely on browser cookies: it sends the same JWT as a Bearer header.
bearer_scheme = HTTPBearer(auto_error=False, description="Token de `POST /api/auth/token` (app móvil).")
Db = Annotated[Session, Depends(get_db)]


def create_token(user: User, lifetime: timedelta | None = None) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    return jwt.encode({
        "sub": str(user.id), "ver": user.token_version, "iat": now,
        "exp": now + (lifetime or timedelta(minutes=settings.token_minutes)),
        "iss": "vetgest", "aud": "vetgest",
    }, settings.jwt_secret, algorithm="HS256")


def get_current_user(db: Db, cookie: Annotated[str | None, Depends(cookie_scheme)],
                     bearer: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)]) -> User:
    unauthorized = HTTPException(401, "Inicia sesión para continuar.")
    # The header wins when both are present: it is explicit and cannot be sent cross-site.
    token = bearer.credentials if bearer else cookie
    if not token:
        raise unauthorized
    try:
        payload = jwt.decode(token, get_settings().jwt_secret, algorithms=["HS256"],
                             issuer="vetgest", audience="vetgest",
                             options={"require": ["sub", "ver", "iat", "exp"]})
        user = db.get(User, int(payload["sub"]))
        if not user or payload["ver"] != user.token_version or not can_sign_in(user):
            raise unauthorized
        return user
    except (jwt.InvalidTokenError, ValueError, TypeError, KeyError):
        raise unauthorized from None


def can_sign_in(user: User) -> bool:
    if not user.is_active:
        return False
    if user.role == "staff":
        return bool(user.membership and user.membership.clinic.is_active)
    return True


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_owner(user: CurrentUser) -> User:
    if user.role != "owner":
        raise HTTPException(403, "Esta sección es solo para propietarios de mascotas.")
    return user


def require_platform_admin(user: CurrentUser) -> User:
    if user.role != "platform_admin":
        raise HTTPException(403, "Esta sección es solo para la administración de VetGest.")
    return user


def require_staff(*roles: str):
    """Staff member of an active clinic, optionally restricted to some clinic roles."""
    def dependency(user: CurrentUser) -> ClinicMember:
        member = user.membership if user.role == "staff" else None
        if not member or (roles and member.role not in roles):
            raise HTTPException(403, "No tienes permisos para esta acción en la veterinaria.")
        return member
    return dependency


Owner = Annotated[User, Depends(require_owner)]
PlatformAdmin = Annotated[User, Depends(require_platform_admin)]
Staff = Annotated[ClinicMember, Depends(require_staff())]
ClinicAdmin = Annotated[ClinicMember, Depends(require_staff("admin"))]
FrontDesk = Annotated[ClinicMember, Depends(require_staff("admin", "reception"))]
Clinician = Annotated[ClinicMember, Depends(require_staff("admin", "vet"))]
