#!/usr/bin/env bash
# Producción: backend :8110 sirviendo dist + /api (sin reload).
#
# Carga automáticamente .env.local si existe (ADMIN_PASSWORD, etc.).
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d ".venv" ]; then
    python3 -m venv .venv
    .venv/bin/pip install --quiet --upgrade pip
    .venv/bin/pip install --quiet -r requirements.txt
fi

if [ -f ".env.local" ]; then
    set -a
    # shellcheck disable=SC1091
    . ./.env.local
    set +a
fi

PORT="${PORT:-8110}"
exec .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port "$PORT" --log-level info
