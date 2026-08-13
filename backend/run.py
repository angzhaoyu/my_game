"""Windows 本地一键启动使用的唯一 Python 入口。

不创建环境、不安装依赖；只生成本地配置、迁移数据库、初始化一次测试账号并启动 Flask。
"""
from __future__ import annotations

import sys
import traceback
from importlib import import_module
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
ENV_FILE = BACKEND_DIR / ".env"
ERROR_LOG = BACKEND_DIR / "启动错误.log"

LOCAL_ENV = """APP_ENV=development
HOST=0.0.0.0
PORT=8000
APP_SECRET=local-double-click-development-secret
ACCESS_TOKEN_TTL_SECONDS=7200
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=123456
DB_NAME=game_db
DB_CONNECT_TIMEOUT_SECONDS=5
WECHAT_APP_ID=
WECHAT_APP_SECRET=
ENABLE_PASSWORD_AUTH=true
ALLOW_DEMO_SEED=true
ALLOWED_ORIGINS=http://localhost:7456,http://127.0.0.1:7456
"""


def ensure_local_config() -> None:
    if ENV_FILE.exists():
        print("[1/3] 本地配置已就绪。", flush=True)
        return
    ENV_FILE.write_text(LOCAL_ENV, encoding="utf-8")
    print("[1/3] 已生成本地配置 backend/.env。", flush=True)


def write_error_log() -> None:
    ERROR_LOG.write_text(traceback.format_exc(), encoding="utf-8")
    print(f"详细错误已保存到：{ERROR_LOG}", flush=True)


def main() -> int:
    ensure_local_config()
    try:
        import_module("flask")
        import_module("pymysql")
        from app import create_app
        from app.manage import migrate, seed_demo
        from app.repositories.mysql import MySQLRepository
        from app.settings import Settings
    except ModuleNotFoundError as exc:
        print(f"[启动失败] 指定的 yolo_v5 环境缺少模块：{exc.name}", flush=True)
        print("按要求，启动脚本不会创建环境，也不会自动安装依赖。", flush=True)
        write_error_log()
        return 1

    try:
        settings = Settings.from_env()
        repository = MySQLRepository(settings)

        print("[2/3] 正在检查数据库结构和测试账号...", flush=True)
        migrate(repository, settings)
        seed_demo(repository, settings)

        app = create_app(settings, repository=repository)
        ERROR_LOG.unlink(missing_ok=True)
        print("[3/3] 游戏服务器启动完成：http://127.0.0.1:8000", flush=True)
        print("测试账号：test / test12345 / 大区一 · 电信", flush=True)
        print("关闭此窗口即可停止服务器。", flush=True)
        app.run(host=settings.host, port=settings.port, debug=False)
        return 0
    except KeyboardInterrupt:
        return 0
    except Exception:
        print("[启动失败] 请检查 MySQL 是否启动，以及 backend/.env 中的数据库配置。", flush=True)
        write_error_log()
        return 1


if __name__ == "__main__":
    sys.exit(main())
