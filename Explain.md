# 项目结构说明

本项目由 **Cocos Creator 3.8.x 微信小游戏前端**和 **Flask + MySQL 后端**组成。当前结构按“领域、应用、基础设施、表现”拆分，目的是让客户端、后端、策划、UI/美术和运维可以并行工作。

> `frontend/scenes/*.scene.md` 与 `frontend/resources/images.md` 是场景/资源契约说明，不是 Cocos 自动生成的 `.scene`、`.meta` 或图片文件。把代码合入真实 Cocos 工程时，应按这些契约挂载组件和资源。

## 顶层结构

```text
my_game/
├── backend/                       # 服务端（权威数据与规则）
│   ├── app/
│   │   ├── api/                   # HTTP 适配层：鉴权、参数接收、统一响应
│   │   ├── domain/                # 纯领域：农场规则、目录、模型、错误
│   │   ├── services/              # 用例：登录、bootstrap、幂等命令
│   │   ├── repositories/          # MySQL 适配器与事务
│   │   ├── __init__.py            # 唯一 Flask 应用工厂
│   │   ├── manage.py              # migrate / seed-demo
│   │   └── settings.py            # 环境配置
│   ├── migrations/                # 可审查、可追踪的 SQL 迁移
│   ├── tests/                     # 不依赖 MySQL 的自动测试
│   ├── 启动游戏服务器.bat          # Windows 一键启动（普通开发只用它）
│   ├── server.py                  # 唯一本地入口：自动建库/迁移并启动
│   ├── compose.yaml               # Docker 部署方式
│   └── Dockerfile
├── frontend/
│   ├── scripts/
│   │   ├── core/                  # 与 Cocos 解耦的客户端基础设施
│   │   │   ├── auth/              # 微信登录、短期会话
│   │   │   ├── config/            # API 地址/超时等环境配置
│   │   │   ├── game/              # 游戏 API 与远端配置装载
│   │   │   ├── network/           # wx.request/XHR、超时、退避重试
│   │   │   ├── storage/           # wx/localStorage 统一适配
│   │   │   └── sync/              # 幂等命令队列、版本冲突恢复
│   │   ├── login/                 # 登录场景表现层
│   │   └── farm/
│   │       ├── config/            # 服务端配置的运行时镜像（只用于显示）
│   │       ├── data/              # 客户端展示模型
│   │       ├── ui/                # Cocos 组件
│   │       ├── GameAction.ts      # UI 到应用层的命令接口
│   │       └── GameRoot.ts        # 场景装配与快照投影
│   ├── scenes/                    # 场景节点契约文档
│   ├── resources/                 # 资源契约文档
│   ├── package.json
│   └── tsconfig.core.json         # 不依赖 cc 的核心模块类型检查
├── docs/                           # 架构、API、上线、协作说明
├── .github/                        # CODEOWNERS、PR 模板
└── docs/ci.workflow.yml.example   # GitHub Actions 模板（需维护者启用）
```

## 关键边界

1. **后端权威**：价格、初始背包、金币、经验、成长、收获和土地状态都由后端创建与校验；前端不能上传整包数据覆盖数据库。
2. **前端快照**：前端模型只是最近一次服务端快照的投影。离线缓存仅用于只读首屏，不作为服务端恢复来源。
3. **弱网命令**：每个写操作都有持久化 `commandId`，服务端幂等；客户端串行发送、超时重试，并用 `stateVersion` 处理多设备冲突。
4. **配置下发**：物品、商店、作物、土地、天气配置由 `/api/v1/game/bootstrap` 下发；客户端配置文件只保留启动默认形状和显示算法。
5. **微信鉴权**：小游戏调用 `wx.login`，后端调用微信 `jscode2session`。`WECHAT_APP_SECRET` 永远只存在服务端。

进一步阅读：

- [架构与数据流](docs/ARCHITECTURE.md)
- [接口契约](docs/API.md)
- [微信小游戏上线清单](docs/WECHAT_RELEASE.md)
- [协作约定](docs/CONTRIBUTING.md)
- [后端运行说明](backend/README.md)
- [前端接入说明](frontend/README.md)
