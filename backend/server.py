# -*- coding: utf-8 -*-
"""
星域传说 · 游戏账号登录服务器（Flask + MySQL）
接口：
    GET  /api/regions       大区列表
    POST /api/login         登录（与 MySQL 的 users 表比对）
    POST /api/register      注册（写入 MySQL）
    GET  /                  登录页面（手机横屏）

运行：
    1) 把 config.py 里的 password 改成你自己的 MySQL 密码
    2) 双击「启动游戏服务器.bat」，或在命令行执行  python server.py
    3) 浏览器打开 http://localhost:8000
"""

import pymysql

from flask import Flask, jsonify, request, send_from_directory

import database as db

app = Flask(__name__, static_folder="static", static_url_path="/static")
app.json.ensure_ascii = False  # 接口直接返回中文，方便调试


# ---------------- CORS 跨域（Cocos 预览/微信开发者工具需要） ----------------

@app.after_request
def _cors_headers(resp):
    resp.headers['Access-Control-Allow-Origin'] = '*'
    resp.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    resp.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return resp


@app.before_request
def _cors_preflight():
    if request.method == 'OPTIONS':
        return '', 204


# ---------------- 页面 ----------------

@app.get("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


# ---------------- 接口 ----------------

@app.get("/api/regions")
def api_regions():
    return jsonify({"success": True, "regions": db.REGIONS})


@app.post("/api/login")
def api_login():
    """登录：拿前端提交的 账号 + 密码 + 大区，与 MySQL users 表比对。"""
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    region = (data.get("region") or "").strip()

    if not username or not password:
        return jsonify({"success": False, "code": "INVALID", "message": "请输入账号和密码"}), 400
    if region not in db.REGIONS:
        return jsonify({"success": False, "code": "INVALID_REGION", "message": "请选择正确的大区"}), 400

    user = db.verify_login(username, password)
    if user is None:
        return jsonify({"success": False, "code": "AUTH_FAILED",
                        "message": "账号或密码错误，请检查后重试"}), 401
    if user["region"] != region:
        return jsonify({"success": False, "code": "REGION_MISMATCH",
                        "message": f"该账号属于【{user['region']}】，请切换到对应大区后登录"}), 403

    return jsonify({"success": True, "message": "登录成功", "user": db.public_profile(user)})


@app.post("/api/register")
def api_register():
    """注册新账号：账号 + 密码 + 大区 → 写入 MySQL users 表（默认金币 100，其他基础属性为 0）。"""
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    region = (data.get("region") or "").strip()

    if not (3 <= len(username) <= 16):
        return jsonify({"success": False, "code": "INVALID_USERNAME",
                        "message": "账号需为 3-16 位字符"}), 400
    if not (6 <= len(password) <= 20):
        return jsonify({"success": False, "code": "INVALID_PASSWORD",
                        "message": "密码长度需为 6-20 位"}), 400
    if region not in db.REGIONS:
        return jsonify({"success": False, "code": "INVALID_REGION", "message": "请选择正确的大区"}), 400

    ok, result = db.register_user(username, password, region)
    if not ok:
        return jsonify({"success": False, "code": "DUPLICATE", "message": result}), 409
    return jsonify({"success": True, "message": "注册成功", "user": db.public_profile(result)}), 201


# ---------------- GameRoot 兼容接口 ----------------

@app.get("/api/game/state")
def api_game_state():
    data = request.get_json(silent=True) or {}
    username = (request.args.get("username") or data.get("username") or "").strip()
    user_id_raw = request.args.get("user_id") or data.get("user_id")

    user_id = None
    if user_id_raw is not None and str(user_id_raw).strip() != "":
        try:
            user_id = int(user_id_raw)
        except ValueError:
            return jsonify({"success": False, "code": "INVALID", "message": "user_id 必须是整数"}), 400

    if not username and user_id is None:
        return jsonify({"success": False, "code": "INVALID", "message": "缺少账号或 user_id"}), 400

    state = db.get_player_game_state(username=username or None, user_id=user_id)
    if state is None:
        return jsonify({"success": False, "code": "NO_USER", "message": "账号不存在"}), 404
    return jsonify({"success": True, "user": state})


@app.post("/api/game/inventory")
def api_game_inventory():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    inventory = data.get("inventory") or []
    if not username:
        return jsonify({"success": False, "code": "INVALID", "message": "缺少账号"}), 400
    ok, result = db.save_player_inventory(username, inventory)
    if not ok:
        return jsonify({"success": False, "code": "NO_USER", "message": result}), 404
    return jsonify({"success": True, "user": result})


# ---------------- 农场接口 ----------------

@app.get("/api/farm")
def api_farm():
    """获取账号的农场：24 块地及各自状态（a正常/b未开发/c肥力充足/d缺水）。"""
    username = (request.args.get("username") or "").strip()
    if not username:
        return jsonify({"success": False, "code": "INVALID", "message": "缺少账号"}), 400
    plots = db.get_farm(username)
    if plots is None:
        return jsonify({"success": False, "code": "NO_USER", "message": "账号不存在"}), 404
    return jsonify({"success": True, "plots": plots})


@app.post("/api/farm/action")
def api_farm_action():
    """对地块执行操作：develop 开发(b->a) / water 浇水(d->a) / fertilize 施肥(a->c)。"""
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    plot_index = data.get("plot_index")
    action = (data.get("action") or "").strip()
    try:
        plot_index = int(plot_index)
    except (TypeError, ValueError):
        return jsonify({"success": False, "code": "INVALID", "message": "地块编号无效"}), 400

    ok, result = db.farm_action(username, plot_index, action)
    if not ok:
        return jsonify({"success": False, "code": "ACTION_FAILED", "message": result}), 400
    return jsonify({"success": True, "message": "操作成功", "plot": result})


# ---------------- 启动 ----------------

if __name__ == "__main__":
    print("正在连接 MySQL 并初始化数据库 ...")
    try:
        db.init_db()
    except Exception as e:
        print("-" * 56)
        print("!!! 连接 MySQL 失败，请检查：")
        print("    1. MySQL 服务是否已启动（Windows: services.msc 里看 MySQL80 是否在运行）")
        print("    2. config.py 里的 user / password 是否填写正确")
        print("    3. 端口是否是 3306")
        print("-" * 56)
        print("错误详情:", repr(e))
        raise SystemExit(1)

    print("=" * 56)
    print("  星域传说 · 登录服务器启动  http://0.0.0.0:8000")
    print("  数据库: MySQL -> %s@%s:%s/%s" % (
        db.DB_CONFIG["user"], db.DB_CONFIG["host"], db.DB_CONFIG["port"], db.DB_CONFIG["database"]))
    print("-" * 56)
    print("  测试账号（大区需对应选择）:")
    print("    admin     / admin123   -> 大区一 · 电信")
    print("    player001 / 123456     -> 大区一 · 电信")
    print("    player002 / 123456     -> 大区二 · 网通")
    print("    player003 / 123456     -> 大区三 · 移动")
    print("    test      / test123    -> 大区二 · 网通")
    print("=" * 56)
    app.run(host="0.0.0.0", port=8000, debug=False)
