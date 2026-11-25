import os
from dataclasses import dataclass, field


def _origins() -> list[str]:
    raw = os.getenv("SHOGI_CORS_ORIGINS", "http://localhost:5173,http://localhost:4173")
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


@dataclass(frozen=True)
class Settings:
    """Configuración leída de variables de entorno."""

    database_url: str = field(default_factory=lambda: os.getenv("DATABASE_URL", "sqlite:///./shogi.db"))
    cors_origins: list[str] = field(default_factory=_origins)
    token_days: int = field(default_factory=lambda: int(os.getenv("SHOGI_TOKEN_DAYS", "30")))


settings = Settings()
