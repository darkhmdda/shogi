FROM python:3.13-slim

WORKDIR /app
COPY pyproject.toml alembic.ini ./
COPY app ./app
COPY migrations ./migrations
RUN pip install --no-cache-dir .

ENV DATABASE_URL=postgresql://shogi:shogi@db:5432/shogi \
    SHOGI_AUTO_CREATE=0
EXPOSE 8000
# Aplica las migraciones pendientes y arranca la API.
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers"]
