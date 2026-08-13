@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ==========================================
echo   Starting game login server...
echo   Then open http://localhost:8000 in browser
echo ==========================================
E:\soft\path\anaconda\envs\yolo_v5\python.exe server.py
pause
