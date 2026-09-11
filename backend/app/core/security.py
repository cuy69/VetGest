from datetime import UTC, datetime, timedelta
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import APIKeyCookie
from pwdlib import PasswordHash
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.models import User

password_hash = PasswordHash.recommended()
dummy_hash = password_hash.hash("dummy-password-never-used-to-log-in")
cookie_scheme = APIKeyCookie(name="vetgest_session", auto_error=False)
Db = Annotated[Session, Depends(get_db)]


def create_token(user: User) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    return jwt.encode({
        "sub": str(user.id), "ver": user.token_version, "iat": now,
        "exp": now + timedelta(minutes=settings.token_minutes),
        "iss": "vetgest", "aud": "vetgest-owner",
    }, settings.jwt_secret, algorithm="HS256")


def get_current_user(db: Db, token: Annotated[str | None, Depends(cookie_scheme)]) -> User:
    unauthorized = HTTPException(401, "Inicia sesión para continuar.")
    if not token:
        raise unauthorized
    try:
        payload = jwt.decode(token, get_settings().jwt_secret, algorithms=["HS256"],
                             issuer="vetgest", audience="vetgest-owner",
                             options={"require": ["sub", "ver", "iat", "exp"]})
        user = db.get(User, int(payload["sub"]))
        if not user or payload["ver"] != user.token_version:
            raise unauthorized
        return user
    except (jwt.InvalidTokenError, ValueError, TypeError, KeyError):
        raise unauthorized from None


CurrentUser = Annotated[User, Depends(get_current_user)]
