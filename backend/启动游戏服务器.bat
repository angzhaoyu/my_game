@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title 随心农场 - 游戏服务器

echo ========================================================
echo   随心农场后端一键启动
echo ========================================================

set "BOOTSTRAP_PY="
where python >nul 2>&1
if not errorlevel 1 set "BOOTSTRAP_PY=python"
if defined BOOTSTRAP_PY goto :python_ready
where py >nul 2>&1
if not errorlevel 1 set "BOOTSTRAP_PY=py -3"
if defined BOOTSTRAP_PY goto :python_ready

echo [错误] 没有找到 Python 3，请先安装 Python 3.10 或更高版本。
goto :failed

:python_ready
if not exist ".venv\Scripts\python.exe" (
    echo [1/5] 第一次运行：正在创建独立 Python 环境...
    %BOOTSTRAP_PY% -m venv .venv
    if errorlevel 1 goto :failed
) else (
    echo [1/5] Python 环境已就绪。
)
set "VENV_PY=.venv\Scripts\python.exe"

"%VENV_PY%" -c "import flask, pymysql" >nul 2>&1
if errorlevel 1 (
    echo [2/5] 第一次运行：正在自动安装后端依赖...
    "%VENV_PY%" -m pip install --disable-pip-version-check -r requirements.txt
    if errorlevel 1 goto :failed
) else (
    echo [2/5] 后端依赖已安装。
)

if not exist ".env" (
    echo [3/5] 第一次运行：正在生成本地配置 .env...
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
    echo [3/5] 本地配置已就绪。
)

echo [4/5] 正在检查数据库结构和测试账号...
"%VENV_PY%" -m app.manage migrate
if errorlevel 1 goto :database_failed
"%VENV_PY%" -m app.manage seed-demo
if errorlevel 1 goto :database_failed

echo [5/5] 启动完成：http://127.0.0.1:8000
echo 测试账号：test / test12345 / 大区一 · 电信
echo 关闭此窗口即可停止服务器。
echo ========================================================
"%VENV_PY%" run.py
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
