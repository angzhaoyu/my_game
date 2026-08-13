# -*- coding: utf-8 -*-
"""
数据库连接配置 —— 新手只需要改这里的 password！

改法：用记事本打开本文件，把 "" 改成你自己的 MySQL 密码，保存即可。
"""

import os

DB_CONFIG = {
    "host": "127.0.0.1",   # MySQL 地址（装在自己电脑上就保持这个）
    "port": 3306,          # MySQL 端口（默认 3306）
    "user": "root",        # MySQL 用户名（默认 root）
    "password": "123456",        # ★★★ 改成你自己的 MySQL 密码 ★★★
    "database": "game_db", # 数据库名（第一次运行会自动创建，不用手动建）
    "charset": "utf8mb4",  # utf8mb4 才能正确存中文，别改
}

# ============ 高级：可以用环境变量覆盖上面的配置（不修改代码） ============
# 例如在命令行运行： GAME_DB_PASSWORD=123456 python server.py
for _k, _env in [
    ("host", "GAME_DB_HOST"),
    ("port", "GAME_DB_PORT"),
    ("user", "GAME_DB_USER"),
    ("password", "GAME_DB_PASSWORD"),
    ("database", "GAME_DB_NAME"),
]:
    if os.environ.get(_env):
        DB_CONFIG[_k] = int(os.environ[_env]) if _k == "port" else os.environ[_env]

# 游戏大区列表（前端登录页会通过 /api/regions 自动拉取）
REGIONS = ["大区一 · 电信", "大区二 · 网通", "大区三 · 移动"]
