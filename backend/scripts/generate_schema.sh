#!/usr/bin/env bash
# Regenera database/schema.sql a partir de las migraciones de Alembic.
# Uso (desde backend/): ./scripts/generate_schema.sh
set -euo pipefail
cd "$(dirname "$0")/.."
{
  echo "-- Esquema PostgreSQL de la aplicación de shōgi."
  echo "-- ARCHIVO GENERADO: no editar a mano. Fuente: backend/migrations (Alembic)."
  echo "-- Regenerar con: cd backend && ./scripts/generate_schema.sh"
  echo
  DATABASE_URL=postgresql://shogi:shogi@localhost/shogi alembic upgrade head --sql 2>/dev/null
} > ../database/schema.sql
echo "database/schema.sql actualizado."
