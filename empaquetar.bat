@echo off
cd /d "%~dp0"
title Los hijos del caos - armar el paquete para regalar
echo.
echo   Los hijos del caos - El ultimo dado
echo   -----------------------------------
echo   Armando el paquete para pasarle a alguien...
echo   (tarda un minuto: son 75 MB de arte y musica)
echo.
python tools/empaquetar.py
if errorlevel 1 (
  echo.
  echo   Algo salio mal. Copia el mensaje de arriba y pasaselo a Claude Code.
  echo.
  pause
  exit /b 1
)
echo   Listo. Abriendo la carpeta dist...
echo.
start "" "%~dp0dist"
pause
