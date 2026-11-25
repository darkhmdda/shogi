from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db import Base, engine
from .routers import auth, games, progress


@asynccontextmanager
async def lifespan(_: FastAPI):
    # En desarrollo crea las tablas si no existen. En producción
    # (SHOGI_AUTO_CREATE=0) el esquema lo gestionan las migraciones de Alembic.
    if settings.auto_create_tables:
        Base.metadata.create_all(engine)
    yield


app = FastAPI(
    title="Shōgi API",
    version="0.1.0",
    description="Cuentas de usuario, sincronización del progreso y partidas guardadas.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(progress.router)
app.include_router(games.router)


@app.get("/health", tags=["sistema"])
def health() -> dict[str, str]:
    return {"status": "ok"}
