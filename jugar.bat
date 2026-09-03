@echo off
cd /d "%~dp0"
title Los hijos del caos - El ultimo dado
echo.
echo   Los hijos del caos - El ultimo dado
echo   -----------------------------------
echo   Abriendo el juego...
echo.
start "Los hijos del caos - servidor" /min python servidor.py
ping -n 3 127.0.0.1 >nul
start "" http://localhost:8123/index.html
echo   Listo. Se abrio el navegador.
echo.
echo   Quedo una ventana minimizada llamada "servidor".
echo   Cerrala cuando termines de jugar.
echo.
timeout /t 6 >nul
