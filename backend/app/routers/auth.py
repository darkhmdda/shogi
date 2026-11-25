from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_session
from ..models import Progress, User
from ..schemas import Credentials, TokenOut, UserOut
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
def login(data: Credentials, session: Session = Depends(get_session)) -> TokenOut:
    user = session.scalar(select(User).where(User.username == data.username.lower()))
    if user is None or not verify_password(data.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Usuario o contraseña incorrectos.")
    return TokenOut(token=issue_token(session, user), username=user.username)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(token: str = Depends(current_token), session: Session = Depends(get_session)) -> None:
    revoke_token(session, token)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)) -> UserOut:
    return UserOut(id=user.id, username=user.username, created_at=user.created_at)
