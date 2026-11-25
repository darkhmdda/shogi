import os
import tempfile

import pytest

# Base de datos temporal para los tests (antes de importar la app).
# Se puede apuntar a PostgreSQL con TEST_DATABASE_URL.
_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = os.getenv("TEST_DATABASE_URL", f"sqlite:///{_tmp}/test.db")

from fastapi.testclient import TestClient  # noqa: E402

from app.db import Base, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.ratelimit import login_limiter  # noqa: E402


@pytest.fixture()
def client():
    login_limiter._failures.clear()
    if os.getenv("TEST_KEEP_SCHEMA"):
        # Esquema creado con database/schema.sql: solo se vacían las tablas.
        with engine.begin() as connection:
            for table in reversed(Base.metadata.sorted_tables):
                connection.execute(table.delete())
    else:
        Base.metadata.drop_all(engine)
        Base.metadata.create_all(engine)
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def auth(client):
    response = client.post("/auth/register", json={"username": "Haru", "password": "contraseña-segura"})
    assert response.status_code == 201
    return {"Authorization": f"Bearer {response.json()['token']}"}
