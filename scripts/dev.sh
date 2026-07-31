#!/usr/bin/env bash
# Arranca backend :8100 y frontend :5173 (requiere venv + npm install previos).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
PY="$BACKEND/.venv/bin/python"

if [[ ! -x "$PY" ]]; then
  echo "No existe $PY. Creá el venv e instalá requirements (ver README)." >&2
  exit 1
fi
if [[ ! -d "$FRONTEND/node_modules" ]]; then
  echo "Falta frontend/node_modules. Ejecutá npm install en frontend/." >&2
  exit 1
fi

echo "Backend -> http://localhost:8100"
(cd "$BACKEND" && "$PY" -m uvicorn main:app --reload --host 0.0.0.0 --port 8100) &
BACKEND_PID=$!
trap 'kill $BACKEND_PID 2>/dev/null || true' EXIT

echo "Frontend -> http://localhost:5173"
cd "$FRONTEND"
npm run dev
