# Immer — AI Interactive Story

一个 AI 驱动的互动故事生成平台，支持单人模式和多人协作模式。

## 功能

- **AI 故事生成** — 选择题材、输入前提，AI 实时生成分支叙事
- **图片生成** — 三种模式：完整（每场景自动配图）、精简（手动点图）、关闭（纯文本）
- **多人协作** — 创建房间邀请朋友一起玩，先到先选决定故事走向
- **信用分系统** — 按图片模式扣费，人工确认付款
- **中英文切换** — 界面支持中文/English

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建 + 生产运行
npm run build
npm start
```

访问 `http://localhost:3000`

## 配置

### LLM API（必需）

打开页面右下角 Settings，配置：

| 字段 | 说明 | 示例 |
|------|------|------|
| API URL | LLM 接口地址 | `https://api.deepseek.com/v1` |
| Model | 模型名称 | `deepseek-chat` |
| API Key | API 密钥 | `sk-...` |

### 图片模型（可选，不配则跳过图片生成）

在 Settings 中配置 Image Model ID：

| 模型 | Image Model ID |
|------|----------------|
| 豆包 Seedream 4.0 | `doubao-seedream-4-0-250828` |
| 豆包 Seedream 5.0 | `doubao-seedream-5-0-260128` |

也可在 `.env.local` 中配置环境变量：

```
SEEDREAM_API_KEY=your_key
SEEDREAM_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
SEEDREAM_MODEL=doubao-seedream-4-0-250828
```

### 管理员密码

```env
ADMIN_SECRET=你的密码
```

## 图片模式

| 模式 | 价格 | 行为 |
|------|------|------|
| 完整 (Full) | ¥10/次 | 每个新场景自动生成配图 |
| 精简 (Lazy) | ¥5/次 | 点击按钮才生成图片 |
| 关闭 (None) | 免费 | 纯文本，不生成图片 |

选择 Full 或 Lazy 模式时，如果信用分不足会阻止游戏开始并提示充值。

## 信用分 / 充值

使用个人微信收款码 + 备注订单号人工确认的方式：

1. 在 Lobby 页面点击 `+5` / `+10` / `+30` 或自定义金额
2. 扫码付款，备注中填写系统生成的订单号
3. 管理员在 `/admin` 页面确认到账
4. 余额自动更新

信用分数据存储在 `.data/credit-store.json`，重启不丢失。

**管理后台：** 访问 `http://localhost:3000/admin`，输入 `ADMIN_SECRET` 密码进入，查看待确认订单并点击「确认到账」。

## 多人模式

1. 在 Lobby 点击「多人模式」
2. 建房间或输入房间号加入
3. 房主点击 START GAME 开始
4. 每个章节所有玩家看到相同内容，先选择的人决定剧情走向

多人房间数据存储在 `.data/multiplayer-store.json`，重启不丢失。

## 数据持久化

系统将关键数据存储在 `.data/` 目录下（已加入 `.gitignore`）：

| 文件 | 内容 |
|------|------|
| `.data/credit-store.json` | 用户余额、交易记录 |
| `.data/multiplayer-store.json` | 多人房间、游戏状态 |

## 技术栈

- **框架：** Next.js 16 (App Router + Turbopack)
- **语言：** TypeScript
- **样式：** Tailwind CSS 4
- **状态管理：** Zustand
- **AI SDK：** OpenAI SDK

## 项目结构

```
src/
├── app/
│   ├── api/              # 后端 API 路由
│   │   ├── credit/       # 信用分系统
│   │   ├── multiplayer/  # 多人模式
│   │   ├── story/        # 故事生成
│   │   ├── admin/        # 管理后台
│   │   └── wechat-pay/   # 微信支付
│   ├── game/             # 单人游戏页面
│   ├── multiplayer/      # 多人游戏页面
│   ├── admin/            # 管理页面
│   └── page.tsx          # Lobby 主页
├── components/           # UI 组件
├── lib/
│   ├── ai/               # AI 客户端 + 提示词
│   ├── credit/           # 信用分 store + client
│   ├── multiplayer/      # 多人模式 store + client
│   ├── wechat-pay/       # 微信支付
│   ├── store.ts          # 全局状态 (Zustand)
│   └── i18n.ts           # 国际化
└── ...
```
