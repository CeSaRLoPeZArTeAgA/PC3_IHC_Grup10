@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] No se encontro Node.js. Instala Node.js 20 o superior.
  pause
  exit /b 1
)

if not exist ".env" (
  if exist ".env.example" (
    copy /y ".env.example" ".env" >nul
    echo Se creo .env a partir de .env.example.
    echo Completa GROQ_API_KEY y GEMINI_API_KEY si quieres funciones de IA y voz.
  )
)

echo Iniciando TriageVoz Rural PC3 en http://127.0.0.1:4173
start "" "http://127.0.0.1:4173"
node server.mjs

pause
