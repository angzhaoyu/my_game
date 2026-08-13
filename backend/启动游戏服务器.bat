@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title 随心农场 - 游戏服务器

set "PYTHON_EXE=E:\soft\path\anaconda\envs\yolo_v5\python.exe"

echo ========================================================
echo   随心农场后端一键启动
echo   Python: %PYTHON_EXE%
echo ========================================================

if not exist "%PYTHON_EXE%" (
    echo [错误] 找不到指定的 Python：
    echo %PYTHON_EXE%
    goto :failed
)

"%PYTHON_EXE%" -c "import flask, pymysql" >nul 2>&1
if errorlevel 1 (
    echo [错误] 指定的 yolo_v5 环境缺少 Flask 或 PyMySQL。
    echo 按要求，本脚本不会创建环境，也不会自动安装依赖。
    goto :failed
)

if not exist ".env" (
    echo [1/3] 第一次运行：正在生成本地配置 .env...
    (
        echo APP_ENV=development
        echo HOST=0.0.0.0
        echo PORT=8000
        echo APP_SECRET=local-double-click-development-secret
        echo ACCESS_TOKEN_TTL_SECONDS=7200
        echo DB_HOST=127.0.0.1
        echo DB_PORT=3306
        echo DB_USER=root
        echo DB_PASSWORD=123456
        echo DB_NAME=game_db
        echo DB_CONNECT_TIMEOUT_SECONDS=5
        echo WECHAT_APP_ID=
        echo WECHAT_APP_SECRET=
        echo ENABLE_PASSWORD_AUTH=true
        echo ALLOW_DEMO_SEED=true
        echo ALLOWED_ORIGINS=http://localhost:7456,http://127.0.0.1:7456
    ) > ".env"
) else (
    echo [1/3] 本地配置已就绪。
)

echo [2/3] 正在检查数据库结构和测试账号...
"%PYTHON_EXE%" -m app.manage migrate
if errorlevel 1 goto :database_failed
"%PYTHON_EXE%" -m app.manage seed-demo
if errorlevel 1 goto :database_failed

echo [3/3] 启动完成：http://127.0.0.1:8000
echo 测试账号：test / test12345 / 大区一 · 电信
echo 关闭此窗口即可停止服务器。
echo ========================================================
"%PYTHON_EXE%" run.py
if errorlevel 1 goto :failed
goto :end

:database_failed
echo.
echo [数据库启动失败]
echo 请确认 MySQL 已启动。本项目沿用原配置：root / 123456。
echo 如果你的 MySQL 密码不同，只需修改 backend\.env 中的 DB_PASSWORD 后重新双击。
goto :failed

:failed
echo.
echo 启动失败，请根据上面的提示处理后重新双击此文件。
pause
exit /b 1

:end
pause
endlocal
