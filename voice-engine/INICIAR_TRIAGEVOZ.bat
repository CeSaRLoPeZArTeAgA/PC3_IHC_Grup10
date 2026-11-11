@echo off
setlocal
cd /d "%~dp0"
title TriageVoz Rural - Tarea 2 - Personalidad adaptativa
chcp 65001 > nul
where py >nul 2>&1
if %errorlevel%==0 (
 set "PY=py"
) else (
 where python >nul 2>&1
 if errorlevel 1 (
  echo ERROR: no se encontro Python. Instala Python 3.11 o superior.
  pause
  exit /b 1
 )
 set "PY=python"
)
if not exist ".venv\Scripts\python.exe" (
 echo Creando entorno virtual en esta carpeta...
 %PY% -m venv .venv
 if errorlevel 1 (
  echo ERROR: no fue posible crear el entorno virtual.
  pause
  exit /b 1
 )
)
echo Instalando o verificando dependencias...
".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 (
 echo ERROR: revisa tu conexion a Internet y las dependencias.
 pause
 exit /b 1
)
echo.
echo INICIANDO TRIAGEVOZ RURAL - VERSION R5 - DOS PROVEEDORES
".venv\Scripts\python.exe" start.py
pause
