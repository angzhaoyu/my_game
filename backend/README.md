# 后端说明

## Windows 本地启动：只需双击

准备条件只有两个：

1. 已安装 Python 3.10 或更高版本；
2. MySQL 已启动（沿用原项目配置：`root / 123456`）。

然后直接双击：

```text
启动游戏服务器.bat
```

第一次双击时脚本会自动完成：

- 创建 `backend/.venv` 独立环境；
- 安装 `requirements.txt`；
- 生成本地 `.env`；
- 创建/升级数据库表；
- 创建后端测试账号；
- 启动 `http://127.0.0.1:8000`。

以后每次仍然只双击同一个文件。关闭命令窗口即可停止服务器。

测试账号：`test / test12345 / 大区一 · 电信`。

如果你的 MySQL 密码不是 `123456`，只需要第一次失败后修改 `backend/.env` 中的 `DB_PASSWORD`，以后仍然直接双击。

## 后端文件是否有重复功能？

已再次合并和清理：删除了重复的 `factory.py`、`wsgi.py`，应用工厂统一放在 `app/__init__.py`。当前入口和目录各自只有一个职责：

| 文件/目录 | 唯一职责 |
|---|---|
| `启动游戏服务器.bat` | Windows 本地一键初始化并启动 |
| `run.py` | 被 bat 调用的本地 Flask 启动入口 |
| `app/__init__.py` | 创建并装配 Flask 应用 |
| `app/api/` | HTTP 路由与鉴权边界 |
| `app/domain/` | 游戏规则、模型和服务端配置 |
| `app/services/` | 登录、bootstrap、幂等命令用例 |
| `app/repositories/` | MySQL 查询和事务 |
| `app/manage.py` | 数据库迁移、首次测试账号、定期清理 |
| `migrations/` | 有版本的数据库结构 |
| `tests/` | 自动测试，不参与运行 |
| `Dockerfile` / `compose.yaml` | 部署或 Docker 开发，不是 Windows 本地入口 |
| `requirements-dev.txt` | 只比正式依赖多测试工具 |

`api/auth.py`、`api/game.py`、`api/health.py` 看起来相似，但分别负责登录、游戏和健康检查，并非重复实现。

## 数据规则

- MySQL 是玩家金币、背包和农场的权威来源；
- 客户端不能提交整包数据覆盖数据库；
- 每个写操作使用 `commandId + stateVersion` 防重复扣款和多设备覆盖；
- 游戏配置和测试数据由后端创建；
- 旧原型表 `users/farm_plots/player_inventory` 不再读写，新表使用 `accounts/player_states/player_farm_plots/player_items`。

## 维护命令（普通启动不需要手动执行）

```bash
# 数据库迁移
.venv/Scripts/python -m app.manage migrate

# 首次创建测试账号；重复执行不会重置已有账号数据
.venv/Scripts/python -m app.manage seed-demo

# 清理 7 天前的幂等记录
.venv/Scripts/python -m app.manage prune-commands --retention-days 7
```

macOS/Linux 对应解释器路径为 `.venv/bin/python`。

## Docker / 生产部署

这部分是部署人员使用的，不影响本地双击启动：

```bash
docker compose up -d --build
```

生产使用 Gunicorn：

```bash
gunicorn --bind 0.0.0.0:8000 --workers 2 --threads 4 --timeout 30 'app:create_app()'
```

生产环境必须设置真实 `APP_SECRET`、`DB_*`、`WECHAT_APP_ID/WECHAT_APP_SECRET`，并关闭 `ENABLE_PASSWORD_AUTH` 与 `ALLOW_DEMO_SEED`。完整上线清单见 `../docs/WECHAT_RELEASE.md`。
