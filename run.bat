@echo off
setlocal

cd /d "%~dp0"

rem Check setup
if not exist ".venv" (
    echo Error: .venv not found. Run setup.bat first.
    exit /b 1
)
if not exist "frontend\node_modules" (
    echo Error: frontend\node_modules not found. Run setup.bat first.
    exit /b 1
)

call .venv\Scripts\activate.bat

echo === TraerPhysics ===
echo.
echo Starting backend  (http://localhost:8000)...
echo Starting frontend (http://localhost:5173)...
echo.
echo Press Ctrl+C to stop both.
echo.

rem Start backend in a new window
start "TraerPhysics Backend" cmd /c "cd /d "%~dp0" && call .venv\Scripts\activate.bat && uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload"

rem Start frontend in a new window
start "TraerPhysics Frontend" cmd /c "cd /d "%~dp0%frontend" && npm run dev"

echo Backend and frontend started in separate windows.
echo Close those windows or press Ctrl+C there to stop them.

endlocal
