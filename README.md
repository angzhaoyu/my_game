# 随心农场 · 微信小游戏工程骨架

这是一个面向微信小游戏上线的 Cocos Creator + Flask + MySQL 农场项目。项目已把原先的客户端整包存档改为**服务端权威命令模型**，并补充微信登录、短期令牌、幂等写入、状态版本、弱网重试、数据库迁移、容器与自动测试。

## 快速开始（本地联调）

### 1. 启动后端

```bash
cd backend
docker compose up -d --build
# 首次需要测试账号时：
docker compose exec api python -m app.manage seed-demo
```

测试账号：`test / test12345 / 大区一 · 电信`。该账号只由后端 seed 命令创建，不存在客户端测试背包。

不用 Docker 时请先准备 MySQL 8：

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env   # Windows 可使用 copy .env.example .env，然后修改
python -m app.manage migrate
python -m app.manage seed-demo
python run.py
```

### 2. 检查

```bash
PYTHONPATH=backend python -m unittest discover -s backend/tests -v
cd frontend && npm ci && npm run typecheck:core
```

### 3. 接入 Cocos

按 `frontend/README.md` 将 `frontend/scripts`、场景节点与资源放进 Cocos Creator 3.8.x 工程。本地预览默认访问 `http://127.0.0.1:8000/api/v1`；微信构建必须注入真实 HTTPS `apiBaseUrl`。

## 上线前必须完成

- 配置微信小游戏 AppID、服务端 `WECHAT_APP_ID/WECHAT_APP_SECRET`；
- 将 HTTPS API 域名加入微信公众平台“服务器域名/request 合法域名”；
- 使用生产随机 `APP_SECRET` 和独立 MySQL 账号，关闭密码登录与 demo seed；
- 在网关配置 TLS、限流、访问日志与告警；
- 执行迁移、备份和灰度/回滚演练；
- 用微信开发者工具测试 2G/高延迟/断网/切后台/重复点击。

完整清单见 [docs/WECHAT_RELEASE.md](docs/WECHAT_RELEASE.md)。
