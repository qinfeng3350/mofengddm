@echo off
setlocal

echo ========================================
echo MoFeng Low-Code Platform - Start Script
echo ========================================
echo.

REM 1) Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
  echo [ERROR] Node.js not found. Please install Node.js 20+ first.
  pause
  exit /b 1
)

REM 2) Check npm
where npm >nul 2>&1
if %errorlevel% neq 0 (
  echo [ERROR] npm not found. Please check your Node.js installation.
  pause
  exit /b 1
)

REM 3) Install dependencies (use npx pnpm to avoid PATH issues)
echo [1/2] Installing/checking dependencies...
set CI=true
call npx -y pnpm install
if %errorlevel% neq 0 (
  echo [ERROR] Dependency installation failed.
  pause
  exit /b 1
)

REM 4) Start frontend and backend
echo [2/2] Starting frontend and backend...
echo.
echo Frontend: http://localhost:3000
echo Backend : http://localhost:4000/api
echo.
echo Press Ctrl+C to stop.
echo ========================================
echo.

call npx -y pnpm dev

endlocal
