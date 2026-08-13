# 后端服务

## 设计原则

- MySQL 保存玩家权威状态；一次命令中的金币、背包和土地修改处于同一事务。
- API 从 Bearer token 获取用户 ID，不接受客户端指定其他 `user_id`。
- 写操作使用 `commandId` 去重，并要求 `expectedVersion`，解决超时重试与多设备并发。
- 游戏目录在 `app/domain/catalog.py`，初始物品也由服务端创建。
- 应用启动不偷偷建表/写 demo；迁移与测试数据是显式管理命令。
- 新表使用 `accounts/player_states/player_farm_plots/player_items`；旧原型的 `users/farm_plots/player_inventory` 不再读写，避免直接启动时误覆盖旧测试库。

## 环境变量

本地可复制 `.env.example` 为 `.env`，服务会读取它，但真实环境变量优先。生产不要把 `.env` 打进镜像，应由容器编排/密钥管理服务注入。

| 名称 | 用途 | 生产要求 |
|---|---|---|
| `APP_ENV` | `development` / `production` | `production` |
| `APP_SECRET` | access token HMAC 密钥 | 至少 32 位随机值 |
| `DB_*` | MySQL 连接 | 独立低权限账号 |
| `WECHAT_APP_ID` | 小游戏 AppID | 必填 |
| `WECHAT_APP_SECRET` | 小游戏 Secret | 必填且不可进 Git/客户端 |
| `ENABLE_PASSWORD_AUTH` | 本地账号接口 | 生产必须 `false` |
| `ALLOW_DEMO_SEED` | demo seed 开关 | 生产必须 `false` |
| `ALLOWED_ORIGINS` | Cocos Web 预览 CORS 白名单 | 不要使用 `*` |

`Settings.validate()` 会拒绝明显不安全的生产配置。

如果旧原型库里有需要保留的真实玩家数据，请先备份并单独编写一次性校验迁移；不要把旧的客户端整包数据直接复制为权威资产。纯测试数据直接运行 `seed-demo` 重建。

## 本地方式 A：Docker

```bash
docker compose up -d --build
docker compose exec api python -m app.manage seed-demo
curl http://localhost:8000/api/v1/health/ready
```

## 本地方式 B：Python + MySQL 8

```bash
python -m venv .venv
source .venv/bin/activate            # Windows 使用 .venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env                # 修改数据库密码等
python -m app.manage migrate
python -m app.manage seed-demo
python run.py
```

正式服务使用：

```bash
gunicorn --bind 0.0.0.0:8000 --workers 2 --threads 4 --timeout 30 wsgi:app
```

生产不要使用 Flask 自带服务器，也不要在每个 API 实例启动时并发执行迁移；迁移应是部署流水线的独立步骤。

## 测试

领域/应用测试使用内存 fake，无需 MySQL；API 契约测试需要先安装 `requirements-dev.txt`：

```bash
cd ..
PYTHONPATH=backend python -m unittest discover -s backend/tests -v
python -m compileall -q backend/app backend/tests
```

上线流水线还应增加 MySQL 集成测试（迁移、事务锁和约束）及压测。

## 新增功能放在哪里

- 新作物/价格/初始物品：`app/domain/catalog.py`，同时提升 `CATALOG_VERSION`；
- 新操作：`GameEngine.ALLOWED_COMMANDS` + `_handle_*`，再扩展 API 文档和测试；
- 新表：只新增 `migrations/NNN_name.sql`，不要运行时 `ALTER TABLE`；
- 微信/第三方服务：放 `services` 的 gateway，不要写进 API route；
- SQL：只放 `repositories`，领域模块不得 import PyMySQL/Flask。

## 运维建议

- `GET /api/v1/health/live` 只检查进程；`ready` 检查 MySQL。
- 每日执行 `python -m app.manage prune-commands --retention-days 7` 并监控幂等表增长。
- 在 API 网关按 IP/openid 做登录和命令限流；多实例不要使用进程内限流器。
- MySQL 使用 UTC、自动备份、时间点恢复和主从/云高可用。
- 日志中的 `X-Request-ID` 可与客户端错误对应；不要记录 token、wx code 或密码。
