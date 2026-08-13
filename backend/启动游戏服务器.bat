@echo off
chcp 65001 >nul
cd /d "%~dp0"
python -m app.manage migrate
if errorlevel 1 pause & exit /b 1
python run.py
pause
