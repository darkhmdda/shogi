from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..db import get_session
from ..models import AuthToken, Progress, User
from ..ratelimit import login_limiter
from ..schemas import Credentials, PasswordChange, PasswordConfirm, TokenOut, UserOut
from ..security import current_token, current_user, hash_password, issue_token, revoke_token, verify_password

router = APIRouter(prefix="/auth", tags=["cuentas"])


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def register(data: Credentials, session: Session = Depends(get_session)) -> TokenOut:
    username = data.username.lower()
    if session.scalar(select(User).where(User.username == username)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Ese nombre de usuario ya existe.")
    user = User(username=username, password_hash=hash_password(data.password))
    user.progress = Progress(lessons={}, puzzles={})
    session.add(user)
    session.commit()
    return TokenOut(token=issue_token(session, user), username=user.username)


@router.post("/login", response_model=TokenOut)
def login(data: Credentials, request: Request, session: Session = Depends(get_session)) -> TokenOut:
    username = data.username.lower()
    key = f"{username}|{request.client.host if request.client else '-'}"
    wait = login_limiter.retry_after(key)
    if wait:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            f"Demasiados intentos fallidos. Vuelve a intentarlo en {wait} segundos.",
            headers={"Retry-After": str(wait)},
        )

    user = session.scalar(select(User).where(User.username == username))
    if user is None or not verify_password(data.password, user.password_hash):
        login_limiter.fail(key)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Usuario o contraseña incorrectos.")

    login_limiter.reset(key)
    # Limpieza de sesiones caducadas del usuario.
    session.execute(
        delete(AuthToken).where(AuthToken.user_id == user.id, AuthToken.expires_at < datetime.now(timezone.utc))
    )
    return TokenOut(token=issue_token(session, user), username=user.username)


@router.post("/password", response_model=TokenOut)
def change_password(
    data: PasswordChange, user: User = Depends(current_user), session: Session = Depends(get_session)
) -> TokenOut:
    """Cambia la contraseña, cierra todas las sesiones y devuelve un token nuevo para este dispositivo."""
    if not verify_password(data.current_password, user.password_hash):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "La contraseña actual no es correcta.")
    user.password_hash = hash_password(data.new_password)
    session.execute(delete(AuthToken).where(AuthToken.user_id == user.id))
    session.commit()
    return TokenOut(token=issue_token(session, user), username=user.username)


@router.post("/delete", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    data: PasswordConfirm, user: User = Depends(current_user), session: Session = Depends(get_session)
) -> None:
    """Borra la cuenta y todos sus datos (progreso, partidas y sesiones)."""
    if not verify_password(data.password, user.password_hash):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "La contraseña no es correcta.")
    session.execute(delete(AuthToken).where(AuthToken.user_id == user.id))
    session.delete(user)
    session.commit()


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(token: str = Depends(current_token), session: Session = Depends(get_session)) -> None:
    revoke_token(session, token)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)) -> UserOut:
    return UserOut(id=user.id, username=user.username, created_at=user.created_at)
