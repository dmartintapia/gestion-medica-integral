@echo off
setlocal

cd /d "%~dp0"

echo ==========================================
echo   Gestion Medica Integral - Inicio
echo ==========================================
echo.

where docker >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Docker no esta instalado o no esta en PATH.
  echo Instala Docker Desktop y vuelve a intentar.
  exit /b 1
)

docker info >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Docker Desktop no esta corriendo.
  echo Abre Docker Desktop y espera a que el engine este activo.
  exit /b 1
)

if not exist "backend\.env" (
  if exist "backend\.env.example" (
    echo [INFO] No existe backend\.env. Se creara desde backend\.env.example
    copy /Y "backend\.env.example" "backend\.env" >nul
  ) else (
    echo [ERROR] No existe backend\.env ni backend\.env.example
    exit /b 1
  )
)

echo [INFO] Iniciando contenedores...
docker compose up -d --build
if errorlevel 1 (
  echo.
  echo [ERROR] No se pudo iniciar el proyecto.
  exit /b 1
)

echo.
echo [OK] Proyecto iniciado.
echo Frontend: http://localhost:5173
echo Backend:  http://localhost:4000/health
echo Nginx:    http://localhost:8080
echo.
echo Credenciales de prueba:
echo - Paciente: juan.perez@gmi.local / Paciente123*
echo - Admin:    admin@gmi.local / Admin123*
echo - Medico:   carolina.mendez@gmi.local / Medico123*
echo.
echo Para ver logs:
echo docker compose logs -f backend
echo docker compose logs -f frontend
echo.
pause
