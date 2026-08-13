# -*- coding: utf-8 -*-
"""
星域传说 · 游戏账号数据库层 —— MySQL 版
- 存储方式：MySQL（你电脑上已安装的那个），库名 game_db，表名 users
- 密码：加盐 PBKDF2 哈希存储，绝不存明文
- 建表结构：utf8mb4，支持中文
"""

import hashlib
import json
import os

import pymysql
from pymysql.cursors import DictCursor
from typing import List, Optional
from config import DB_CONFIG, REGIONS

PBKDF2_ITERATIONS = 120_000  # 密码哈希迭代次数

# 用户表结构（金币 / 等级 / 经验值 / 钻石 都在这里）
SCHEMA = [
    """
    CREATE TABLE IF NOT EXISTS users (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        username      VARCHAR(32)  NOT NULL UNIQUE COMMENT '登录账号',
        password_hash VARCHAR(128) NOT NULL COMMENT '密码哈希(不存明文)',
        salt          VARCHAR(64)  NOT NULL COMMENT '哈希盐',
        region        VARCHAR(64)  NOT NULL COMMENT '所属大区',
        coins         INT NOT NULL DEFAULT 100 COMMENT '金币',
        level         INT NOT NULL DEFAULT 0 COMMENT '等级',
        exp           INT NOT NULL DEFAULT 0 COMMENT '经验值',
        diamonds      INT NOT NULL DEFAULT 0 COMMENT '钻石',
        created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '注册时间'
    ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='游戏用户表';
    """,
    """
    -- 农场地块表：每个用户 24 块地（4 行 x 6 列，plot_index = 行*6 + 列）
    CREATE TABLE IF NOT EXISTS farm_plots (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        user_id    INT NOT NULL COMMENT '所属用户',
        plot_index INT NOT NULL COMMENT '地块编号 0-23',
        state      VARCHAR(4) NOT NULL DEFAULT 'a' COMMENT '状态: a正常 b未开发 c肥力充足 d缺水',
        crop_type  VARCHAR(32) DEFAULT NULL COMMENT '作物类型(预留)',
        planted_at DATETIME DEFAULT NULL COMMENT '种植时间(预留)',
        grow_stage INT NOT NULL DEFAULT 0 COMMENT '生长阶段(预留)',
        UNIQUE KEY uq_user_plot (user_id, plot_index),
        CONSTRAINT fk_farm_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='农场地块表';
    """,
    """
    CREATE TABLE IF NOT EXISTS player_inventory (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        user_id     INT NOT NULL COMMENT '所属用户',
        item_id     VARCHAR(64) NOT NULL COMMENT '物品ID',
        item_name   VARCHAR(128) NOT NULL COMMENT '物品名称',
        icon        VARCHAR(128) NOT NULL COMMENT '图标名',
        category    VARCHAR(32) NOT NULL DEFAULT 'seed' COMMENT '分类',
        count       INT NOT NULL DEFAULT 0 COMMENT '数量',
        value       INT NOT NULL DEFAULT 0 COMMENT '回收价',
        acquired_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '获得时间',
        UNIQUE KEY uq_user_item (user_id, item_id),
        CONSTRAINT fk_inventory_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='玩家背包物品表';
    """,
]


# ---------------- 连接 ----------------

def _connect(database: bool = True):
    """建立 MySQL 连接。database=False 时先不选库（用于创建数据库）。"""
    cfg = dict(DB_CONFIG)
    if not database:
        cfg.pop("database", None)
    return pymysql.connect(
        **cfg,
        cursorclass=DictCursor,   # 查询结果返回字典，方便取字段
        autocommit=True,
    )


# ---------------- 密码安全 ----------------

def hash_password(password: str, salt: Optional[str] = None):
    """返回 (salt, digest)。不传 salt 时随机生成。"""
    if salt is None:
        salt = os.urandom(16).hex()
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), bytes.fromhex(salt), PBKDF2_ITERATIONS
    ).hex()
    return salt, digest


# ---------------- 初始化：建库 / 建表 / 演示数据 ----------------

def init_db():
    """第一次运行自动完成：创建数据库 -> 创建 users 表 -> 写入演示账号。
    重复运行是安全的（IF NOT EXISTS / 已有数据则跳过）。"""
    # 1) 先不选库，创建 game_db
    conn = _connect(database=False)
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"CREATE DATABASE IF NOT EXISTS `{DB_CONFIG['database']}` "
                "DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
            )
    finally:
        conn.close()

    # 2) 连上 game_db，建表 + 写入演示账号 + 初始化农场
    conn = _connect(database=True)
    try:
        with conn.cursor() as cur:
            for stmt in SCHEMA:
                cur.execute(stmt)
        _ensure_schema(conn)
        _seed_if_empty(conn)
        _seed_inventory_if_empty(conn)
        _ensure_farms(conn)
    finally:
        conn.close()


def _ensure_schema(conn):
    with conn.cursor() as cur:
        cur.execute("ALTER TABLE users ALTER COLUMN coins SET DEFAULT 100")
        cur.execute("ALTER TABLE users ALTER COLUMN level SET DEFAULT 0")
        cur.execute("ALTER TABLE users ALTER COLUMN exp SET DEFAULT 0")
        cur.execute("ALTER TABLE users ALTER COLUMN diamonds SET DEFAULT 0")


def _seed_if_empty(conn):
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) AS c FROM users")
        if cur.fetchone()["c"] > 0:
            return
        demo = [
            # username  password  大区              金币    等级  经验     钻石
            ("admin",     "admin123", "大区一 · 电信", 99999, 60, 235000, 8888),
            ("player001", "123456",   "大区一 · 电信", 12500, 23, 34200,  320),
            ("player002", "123456",   "大区二 · 网通", 8600,  18, 21500,  150),
            ("player003", "123456",   "大区三 · 移动", 45200, 35, 88000,  760),
            ("test",      "test123",  "大区二 · 网通", 300,   5,  800,    20),
        ]
        rows = []
        for username, pwd, region, coins, level, exp, diamonds in demo:
            salt, digest = hash_password(pwd)
            rows.append((username, digest, salt, region, coins, level, exp, diamonds))
        cur.executemany(
            "INSERT INTO users (username,password_hash,salt,region,coins,level,exp,diamonds)"
            " VALUES (%s,%s,%s,%s,%s,%s,%s,%s)",
            rows,
        )


# ---------------- 查询 / 登录 / 注册 ----------------

def find_by_username(username: str):
    conn = _connect()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM users WHERE username = %s", (username,))
            return cur.fetchone()  # dict 或 None
    finally:
        conn.close()


def verify_login(username: str, password: str):
    """核对账号密码。成功返回用户资料(dict)，失败返回 None。"""
    row = find_by_username(username)
    if row is None:
        return None
    _, expected = hash_password(password, row["salt"])
    if expected != row["password_hash"]:
        return None
    return row


def register_user(username: str, password: str, region: str):
    """创建新账号（默认金币 100，其他基础属性为 0）。返回 (成功?, 用户dict或错误信息)。"""
    if find_by_username(username) is not None:
        return False, "该账号已被注册"
    salt, digest = hash_password(password)
    conn = _connect()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO users (username,password_hash,salt,region,coins,level,exp,diamonds) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s,%s)",
                (username, digest, salt, region, 100, 0, 0, 0),
            )
            new_id = cur.lastrowid
        _ensure_farm_for(conn, new_id)  # 新账号自动获得 24 块地
        return True, find_by_username(username)
    except pymysql.err.IntegrityError:
        return False, "该账号已被注册"
    finally:
        conn.close()


def public_profile(row: dict) -> dict:
    """对外返回用户资料（剔除密码哈希、盐等敏感字段）。"""
    return {
        "id": row["id"],
        "username": row["username"],
        "region": row["region"],
        "coins": row["coins"],
        "gold": row["coins"],
        "level": row["level"],
        "exp": row["exp"],
        "diamonds": row["diamonds"],
        "created_at": str(row["created_at"]),
    }


def _seed_inventory_if_empty(conn):
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) AS c FROM player_inventory")
        if cur.fetchone()["c"] > 0:
            return
        cur.execute("SELECT id, username FROM users")
        users = cur.fetchall()
        sample_rows = []
        for row in users:
            if row["username"] in {"admin", "test"}:
                sample_rows.extend([
                    (row["id"], "seed_wheat", "小麦种子", "seed_wheat", "seed", 3, 18),
                    (row["id"], "fert_organic", "有机肥", "fert_organic", "fert", 2, 24),
                ])
        if sample_rows:
            cur.executemany(
                "INSERT INTO player_inventory (user_id, item_id, item_name, icon, category, count, value) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s)",
                sample_rows,
            )


def get_player_game_state(username: str = None, user_id: int = None):
    conn = _connect()
    try:
        with conn.cursor() as cur:
            if user_id is not None:
                cur.execute("SELECT * FROM users WHERE id = %s", (user_id,))
            elif username:
                cur.execute("SELECT * FROM users WHERE username = %s", (username,))
            else:
                return None
            user = cur.fetchone()
            if user is None:
                return None
            cur.execute(
                "SELECT item_id, item_name, icon, category, count, value, acquired_at "
                "FROM player_inventory WHERE user_id = %s ORDER BY item_id",
                (user["id"],),
            )
            inventory = [
                {
                    "id": r["item_id"],
                    "name": r["item_name"],
                    "icon": r["icon"],
                    "category": r["category"],
                    "count": r["count"],
                    "value": r["value"],
                    "acquired": str(r["acquired_at"]),
                }
                for r in cur.fetchall()
            ]
        return {
            "id": user["id"],
            "username": user["username"],
            "region": user["region"],
            "coins": user["coins"],
            "gold": user["coins"],
            "level": user["level"],
            "exp": user["exp"],
            "diamonds": user["diamonds"],
            "inventory": inventory,
        }
    finally:
        conn.close()


def save_player_inventory(username: str, inventory: list):
    user = find_by_username(username)
    if user is None:
        return False, "账号不存在"
    conn = _connect()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM player_inventory WHERE user_id = %s", (user["id"],))
            for stack in inventory or []:
                if not stack:
                    continue
                item_id = str(stack.get("id") or stack.get("item_id") or "")
                if not item_id:
                    continue
                count = int(stack.get("count") or 0)
                if count <= 0:
                    continue
                cur.execute(
                    "INSERT INTO player_inventory (user_id, item_id, item_name, icon, category, count, value) "
                    "VALUES (%s,%s,%s,%s,%s,%s,%s)",
                    (
                        user["id"],
                        item_id,
                        str(stack.get("name") or item_id),
                        str(stack.get("icon") or item_id),
                        str(stack.get("category") or "seed"),
                        count,
                        int(stack.get("value") or 0),
                    ),
                )
        return True, get_player_game_state(username)
    finally:
        conn.close()


# ============================================================
# 农场
# ============================================================

PLOTS_PER_FARM = 24

# 状态显示优先级：缺水 > 未开发 > 肥力充足 > 正常
STATE_PRIORITY = {"d": 4, "b": 3, "c": 2, "a": 1}

# 默认地块状态分布（按 user_id 轮转，让不同账号农场略有差异）
_DEFAULT_PATTERN = {"d": [0, 9, 15, 20], "c": [6, 12, 13, 18], "b": [4, 5, 10, 11]}


def default_farm_states(user_id: int) -> List[str]:
    """返回 24 个地块的默认状态（a/b/c/d），按 user_id 偏移使各账号不同。"""
    states = ["a"] * PLOTS_PER_FARM
    shift = user_id % PLOTS_PER_FARM
    for state, indices in _DEFAULT_PATTERN.items():
        for idx in indices:
            states[(idx + shift) % PLOTS_PER_FARM] = state
    return states


def _ensure_farms(conn):
    """为所有已存在用户补建农场数据（重复运行安全）。"""
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM users")
        user_ids = [r["id"] for r in cur.fetchall()]
    for uid in user_ids:
        _ensure_farm_for(conn, uid)


def _ensure_farm_for(conn, user_id: int):
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) AS c FROM farm_plots WHERE user_id = %s", (user_id,))
        if cur.fetchone()["c"] >= PLOTS_PER_FARM:
            return
        states = default_farm_states(user_id)
        rows = [(user_id, i, states[i]) for i in range(PLOTS_PER_FARM)]
        cur.executemany(
            "INSERT INTO farm_plots (user_id, plot_index, state) VALUES (%s,%s,%s)",
            rows,
        )


def get_farm(username: str):
    """返回某账号的 24 块地（按 plot_index 排序）。账号不存在返回 None。"""
    user = find_by_username(username)
    if user is None:
        return None
    conn = _connect()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT plot_index, state, crop_type, planted_at, grow_stage "
                "FROM farm_plots WHERE user_id = %s ORDER BY plot_index",
                (user["id"],),
            )
            plots = [
                {
                    "plot_index": r["plot_index"],
                    "state": r["state"],
                    "crop_type": r["crop_type"],
                    "planted_at": str(r["planted_at"]) if r["planted_at"] else None,
                    "grow_stage": r["grow_stage"],
                }
                for r in cur.fetchall()
            ]
        return plots
    finally:
        conn.close()


# 地块操作：b 未开发 -> develop -> a；d 缺水 -> water -> a；a 正常 -> fertilize -> c
PLOT_ACTIONS = {
    "develop": {"from": "b", "to": "a", "label": "开发"},
    "water":   {"from": "d", "to": "a", "label": "浇水"},
    "fertilize": {"from": "a", "to": "c", "label": "施肥"},
}


def farm_action(username: str, plot_index: int, action: str):
    """对地块执行操作。返回 (成功?, 结果dict 或 错误信息)。"""
    user = find_by_username(username)
    if user is None:
        return False, "账号不存在"
    if not (0 <= plot_index < PLOTS_PER_FARM):
        return False, "地块编号无效"
    rule = PLOT_ACTIONS.get(action)
    if rule is None:
        return False, "不支持的操作"

    conn = _connect()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, state FROM farm_plots WHERE user_id = %s AND plot_index = %s",
                (user["id"], plot_index),
            )
            plot = cur.fetchone()
            if plot is None:
                _ensure_farm_for(conn, user["id"])
                cur.execute(
                    "SELECT id, state FROM farm_plots WHERE user_id = %s AND plot_index = %s",
                    (user["id"], plot_index),
                )
                plot = cur.fetchone()
            if plot is None:
                return False, "地块不存在"
            if plot["state"] != rule["from"]:
                return False, f"当前状态不能「{rule['label']}」（需要状态 {rule['from']}）"
            cur.execute(
                "UPDATE farm_plots SET state = %s WHERE id = %s",
                (rule["to"], plot["id"]),
            )
            cur.execute(
                "SELECT plot_index, state, crop_type, planted_at, grow_stage "
                "FROM farm_plots WHERE id = %s",
                (plot["id"],),
            )
            r = cur.fetchone()
            return True, {
                "plot_index": r["plot_index"],
                "state": r["state"],
                "crop_type": r["crop_type"],
                "planted_at": str(r["planted_at"]) if r["planted_at"] else None,
                "grow_stage": r["grow_stage"],
            }
    finally:
        conn.close()
