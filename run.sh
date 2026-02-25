#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Check setup
if [ ! -d ".venv" ]; then
    echo "Error: .venv not found. Run ./setup.sh first."
    exit 1
fi
if [ ! -d "frontend/node_modules" ]; then
    echo "Error: frontend/node_modules not found. Run ./setup.sh first."
    exit 1
fi

source .venv/bin/activate

echo "=== TraerPhysics ==="
echo ""
echo "Starting backend  (http://localhost:8000)..."
echo "Starting frontend (http://localhost:5173)..."
echo ""
echo "Press Ctrl+C to stop both."
echo ""

# Start backend in background
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# Start frontend in background
cd frontend
npm run dev &
FRONTEND_PID=$!
cd "$SCRIPT_DIR"

# Trap Ctrl+C to kill both
cleanup() {
    echo ""
    echo "Shutting down..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    wait $BACKEND_PID 2>/dev/null
    wait $FRONTEND_PID 2>/dev/null
    echo "Done."
}
trap cleanup EXIT INT TERM

# Wait for either process to exit
wait
