# Nexa Server

基于 Express + Prisma + MySQL 的 AI 聊天机器人后端服务，对接 DeepSeek API。

## 技术栈

- **运行时**: Node.js 22+
- **框架**: Express 4
- **ORM**: Prisma 6 + MySQL
- **认证**: Cookie + DB Session（HMAC-SHA256）
- **AI**: DeepSeek API（支持流式 SSE）

## 快速开始

```bash
# 安装依赖
pnpm install

# 配置环境变量
cp .env.example .env
# 编辑 .env，填入 DeepSeek API Key 等信息

# 创建数据库并迁移
pnpm prisma:generate
pnpm prisma db push

# 启动开发服务
pnpm dev
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `NODE_ENV` | 运行环境（development / production） | 必填 |
| `PORT` | HTTP 端口 | `3000` |
| `DATABASE_URL` | MySQL 连接串 | — |
| `DEEPSEEK_API_KEY` | DeepSeek API Key | — |
| `DEEPSEEK_MODEL` | 默认模型 | `deepseek-v4-flash` |
| `AUTH_TOKEN_SECRET` | JWT / Session 签名密钥 | — |
| `CLIENT_ORIGINS` | 允许的跨域来源（逗号分隔） | `http://localhost:5173` |

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/health` | 健康检查 |
| `POST` | `/api/auth/register` | 注册 |
| `POST` | `/api/auth/login` | 登录 |
| `GET` | `/api/auth/me` | 获取当前用户 |
| `POST` | `/api/auth/logout` | 登出 |
| `GET` | `/api/conversations` | 会话列表 |
| `GET` | `/api/conversations/:id` | 会话详情 |
| `DELETE` | `/api/conversations/:id` | 删除会话 |
| `POST` | `/api/chat` | 发送消息 |
| `POST` | `/api/chat/stream` | 流式发送消息（SSE） |

## 项目结构

```
.
├── bin/www              # 入口，优雅关闭
├── config/
│   └── runtimeConfig.js # 集中式配置（环境变量解析 + 校验）
├── controllers/         # 路由处理
├── lib/
│   └── prismaClient.js  # Prisma 客户端（日志 / 错误格式）
├── middleware/          # CORS / Auth / 安全头
├── prisma/
│   └── schema.prisma    # 数据模型
├── routes/
├── services/            # 业务逻辑
└── utils/
```

## 安全

- 密码：scrypt + 随机盐 + 常量时间比较
- Session：随机 48 字节 token，HMAC-SHA256 哈希存储
- Cookie：httpOnly + sameSite + Secure（生产）
- 生产环境：`NODE_ENV=production` 必须显式设置，否则拒绝启动
