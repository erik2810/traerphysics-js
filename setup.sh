#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== TraerPhysics Setup ==="
echo ""

# --- Python backend ---
echo "[1/3] Setting up Python virtual environment..."
if [ ! -d ".venv" ]; then
    python3 -m venv .venv
    echo "  Created .venv"
else
    echo "  .venv already exists, skipping creation"
fi

echo "[2/3] Installing Python dependencies..."
source .venv/bin/activate
pip install --upgrade pip -q
pip install -r requirements.txt -q
echo "  Installed: fastapi, uvicorn, torch, pydantic, websockets"

# --- Node frontend ---
echo "[3/3] Installing Node.js dependencies..."
cd frontend
npm install
cd "$SCRIPT_DIR"

echo ""
echo "=== Setup complete ==="
echo "Run ./run.sh to start the application."
