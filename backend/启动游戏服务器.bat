@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 随心农场 - 游戏服务器
set "PYTHON_EXE=E:\soft\path\anaconda\envs\yolo_v5\python.exe"

echo ========================================================
echo   随心农场后端一键启动
echo   Python: %PYTHON_EXE%
echo ========================================================

if not exist "%PYTHON_EXE%" (
    echo [启动失败] 找不到指定的 Python：
    echo %PYTHON_EXE%
    echo.
    pause
    exit /b 1
)

set PYTHONUNBUFFERED=1
"%PYTHON_EXE%" run.py
set "EXIT_CODE=%ERRORLEVEL%"

echo.
if not "%EXIT_CODE%"=="0" (
    echo 服务器启动失败，请查看上面的错误信息。
    echo 详细错误同时保存在 backend\启动错误.log。
)
echo 按任意键关闭窗口...
pause >nul
exit /b %EXIT_CODE%
