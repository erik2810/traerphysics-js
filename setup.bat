@echo off
setlocal

cd /d "%~dp0"

echo === TraerPhysics Setup ===
echo.

rem --- Python backend ---
echo [1/3] Setting up Python virtual environment...
if not exist ".venv" (
    python -m venv .venv
    echo   Created .venv
) else (
    echo   .venv already exists, skipping creation
)

echo [2/3] Installing Python dependencies...
call .venv\Scripts\activate.bat
pip install --upgrade pip -q
pip install -r requirements.txt -q
echo   Installed: fastapi, uvicorn, torch, pydantic, websockets

rem --- Node frontend ---
echo [3/3] Installing Node.js dependencies...
cd frontend
call npm install
cd /d "%~dp0"

echo.
echo === Setup complete ===
echo Run run.bat to start the application.

endlocal
