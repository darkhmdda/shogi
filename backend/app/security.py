import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import settings
from .db import get_session
from .models import AuthToken, User

_SCRYPT = {"n": 2**14, "r": 8, "p": 1, "dklen": 32}


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, **_SCRYPT)
    return f"scrypt${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, salt_hex, digest_hex = stored.split("$")
    except ValueError:
        return False
    if scheme != "scrypt":
        return False
    digest = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt_hex), **_SCRYPT)
    return hmac.compare_digest(digest.hex(), digest_hex)


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def issue_token(session: Session, user: User) -> str:
    """Crea un token de sesión. En la base de datos solo se guarda su hash."""
    token = secrets.token_urlsafe(32)
    session.add(
        AuthToken(
            user_id=user.id,
            token_hash=_hash_token(token),
            expires_at=datetime.now(timezone.utc) + timedelta(days=settings.token_days),
        )
    )
    session.commit()
    return token


def revoke_token(session: Session, token: str) -> None:
    record = session.scalar(select(AuthToken).where(AuthToken.token_hash == _hash_token(token)))
    if record:
        session.delete(record)
        session.commit()


_bearer = HTTPBearer(auto_error=False)


def current_token(credentials: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> str:
    if credentials is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Falta el token de sesión.")
    return credentials.credentials


def user_for_token(session: Session, token: str) -> User | None:
    """Usuario de un token válido y no caducado, o None."""
    record = session.scalar(select(AuthToken).where(AuthToken.token_hash == _hash_token(token)))
    if record is None:
        return None
    expires = record.expires_at
    if expires.tzinfo is None:  # SQLite no guarda la zona horaria.
        expires = expires.replace(tzinfo=timezone.utc)
    if expires < datetime.now(timezone.utc):
        return None
    return record.user


def current_user(token: str = Depends(current_token), session: Session = Depends(get_session)) -> User:
    user = user_for_token(session, token)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sesión no válida o caducada.")
    return user
