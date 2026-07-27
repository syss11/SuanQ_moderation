# SuanQ 管理系统 - 配置教程

欢迎使用 SuanQ 管理系统！这份教程将帮助你完成所有必要的配置。

## 配置文件说明

项目包含以下配置文件模板（`.example` 后缀），你需要复制它们并去掉 `.example` 后缀来创建实际配置文件：

| 模板文件 | 实际配置文件 | 用途 |
|----------|-------------|------|
| `suanqm-backend/.env.example` | `suanqm-backend/.env` | 数据库连接、登录密码等核心配置 |
| `suanqm-backend/config/config.example.json` | `suanqm-backend/config/config.json` | 机器人行为、规则、AI 等详细配置 |
| `suanqm-backend/config/config.dev.example.json` | `suanqm-backend/config/config.dev.json` | 开发环境配置（可选） |
| `suanqm-frontend/.env.production.example` | `suanqm-frontend/.env.production` | 前端生产环境配置（可选） |

**重要提示**：`.example` 文件是模板，包含脱敏的默认值，可以安全提交到仓库。实际配置文件（去掉 `.example` 后缀）会被 git 忽略，不会提交到仓库。

## 快速开始（5分钟配置）

### 第一步：复制配置模板

在开始配置之前，先复制模板文件：

**Windows（PowerShell）：**

```powershell
cd suanqm-backend
Copy-Item .env.example .env
cd config
Copy-Item config.example.json config.json
```

**Linux/macOS（终端）：**

```bash
cd suanqm-backend
cp .env.example .env
cd config
cp config.example.json config.json
```

### 第二步：配置 .env 文件

打开 `suanqm-backend/.env` 文件，按以下说明填写：

```env
# 数据库配置
# 选择数据库类型：sqljs（简单）或 mysql（性能好）
DB_TYPE=sqljs

# 如果选择 sqljs，数据会保存在这个文件中（无需额外安装）
DB_STORAGE=./data/database.sqlite

# 如果选择 mysql，需要填写以下信息
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=your_db_username
DB_PASSWORD=your_db_password
DB_DATABASE=your_db_name

# 应用配置
APP_PORT=6065
```

#### 数据库选择建议

| 选项 | 适用场景 | 优点 | 缺点 |
|------|----------|------|------|
| sqljs | 单机部署、新手 | 无需安装数据库，开箱即用 | 性能一般，非常容易意外写坏 |
| mysql | 生产环境、高负载 | 性能好，支持并发 | 需要额外安装 MySQL |

**新手推荐使用 `sqljs`，直接跳过 MySQL 安装步骤！**

#### 密码机制

项目采用自动密码生成机制，确保安全性：

**AUTH_PASSWORD（管理后台密码）**
- 用途：用于登录 WebUI 管理后台
- 生成时机：首次启动时自动生成
- 存储位置：`suanqm-backend/.env` 文件
- 查看方式：启动时在控制台日志中显示

### 第三步：配置 config.json 文件

打开 `suanqm-backend/config/config.json` 文件，关键配置项说明：

#### 3.1 基本配置

```json
{
  "deployer": "你的QQ号",
  "enable_commands": true
}
```

- `deployer`: 填写你的 QQ 号，作为机器人的所有者
- `enable_commands`: 是否启用群聊指令功能（建议开启）

#### 3.2 Napcat 配置（最重要！）

这是机器人连接 QQ 的关键配置：

```json
{
  "napcat": {
    "protocol": "ws",
    "host": "localhost",
    "port": 3011,
    "accessToken": "你的napcat令牌",
    "throwPromise": true,
    "reconnection": {
      "enable": true,
      "attempts": 3,
      "delay": 3000
    },
    "debug": false
  }
}
```

**如何获取 Napcat 配置？**

1. 安装并运行 [Napcat](https://github.com/NapNeko/NapCatQQ)
2. 打开 Napcat 的配置文件，找到 `accessToken`
3. 将 `host` 设置为 Napcat 所在的 IP（本地就是 `localhost`）
4. `port` 默认是 `3011`

#### 3.3 白名单/黑名单配置

```json
{
  "rules": {
    "whitelistBlacklist": {
      "enabled": true,
      "mode": "whitelist",
      "groups": [123456789],
      "users": [987654321]
    }
  }
}
```

- `mode`: `whitelist`（白名单模式，只监控指定群）或 `blacklist`（黑名单模式，排除指定群）
- `groups`: 群号列表
- `users`: 用户白名单（不受规则限制）

#### 3.4 防刷屏规则

```json
{
  "rules": {
    "general": {
      "flood": [
        {
          "windowSize": 8,
          "maxMessages": 4.1,
          "maxLength": 300,
          "penalty": {
            "penalty_type": "mute",
            "severity": 1,
            "credit_deduction": 20,
            "penalty_time": 300
          }
        }
      ]
    }
  }
}
```

**规则说明：**
- `windowSize`: 时间窗口（秒）
- `maxMessages`: 窗口内最大消息数
- `maxLength`: 单条消息最大长度
- `penalty_type`: 惩罚类型（`mute` 禁言，`credit_deduction` 扣分）
- `penalty_time`: 禁言时间（秒）

#### 3.5 AI 配置（可选）

```json
{
  "ai": {
    "enable": true,
    "providers": [
      {
        "name": "default",
        "apiKey": "your_ai_api_key",
        "baseURL": "your_ai_base_url",
        "model": "your_ai_model",
        "enable": false
      }
    ],
    "chat_use_provider": ["default"],
    "moderation_use_provider": ["default"],
    "activeProfile": "default"
  }
}
```

**配置说明：**

| 配置项 | 说明 |
|--------|------|
| `enable` | 是否启用 AI 功能（总开关） |
| `providers[0].name` | AI 模型名称（自定义） |
| `providers[0].apiKey` | AI 模型 API 密钥 |
| `providers[0].baseURL` | AI 模型 API 基础 URL |
| `providers[0].model` | 调用模型名称 |
| `providers[0].enable` | 是否启用该模型 |
| `chat_use_provider` | 聊天使用的模型列表 |
| `moderation_use_provider` | 内容审核使用的模型列表 |
| `activeProfile` | 启用的人格配置 |

**如何获取 AI API 密钥？**

1. 注册 [智谱 AI](https://open.bigmodel.cn/) 账号
2. 在控制台创建 API Key
3. 将密钥填入 `apiKey` 字段
4. 设置 `baseURL` 为 `https://open.bigmodel.cn/api/paas/v4/`
5. 设置 `model` 为 `glm-4-flash`
6. 将 `providers[0].enable` 设置为 `true`

**如果不使用 AI 功能**：将 `"enable"` 设置为 `false`（默认关闭）

## WebUI 前端配置

如果需要使用 WebUI 管理界面，需要配置 `suanqm-frontend/.env.production` 文件。

### 复制模板

```powershell
# Windows
cd suanqm-frontend
Copy-Item .env.production.example .env.production

# Linux/macOS
cd suanqm-frontend
cp .env.production.example .env.production
```

### 配置说明

打开 `suanqm-frontend/.env.production` 文件：

```env
VITE_API_BASE_URL=http://your-production-server:6065
VITE_WS_BASE_URL=ws://your-production-server:6065
```

| 场景 | 配置值 |
|------|--------|
| **本地部署** | `http://localhost:6065` 和 `ws://localhost:6065` |
| **服务器部署** | `http://服务器IP:6065` 和 `ws://服务器IP:6065` |

**说明：**
- `VITE_API_BASE_URL`: 前端调用后端 API 的地址
- `VITE_WS_BASE_URL`: WebSocket 连接地址

配置完成后，按照 README.md 中的 WebUI 使用步骤进行构建和部署。

## 完整配置项速查

### 1. debug 调试配置

| 配置项 | 类型 | 说明 |
|--------|------|------|
| `enable_tools` | boolean | 是否启用调试工具 |
| `test_groupid` | number | 测试群号 |

### 2. user 用户配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `credit.default` | number | 80 | 新用户默认积分 |
| `credit.max` | number | 100 | 最大积分 |
| `credit.kick_threshold` | number | -100 | 低于此积分踢出群 |
| `credit.like_award` | number | 1 | 点赞奖励 |
| `credit.dislike_penalty` | number | 1 | 点踩惩罚 |

**积分等级倍率说明：**

| 积分区间 | 惩罚倍率 | 签到奖励 |
|----------|----------|----------|
| 80-100 | 0.4x | +2 |
| 60-79 | 0.8x | +3 |
| 30-59 | 1x | +4 |
| 0-29 | 4x | +5 |
| -30~-1 | 8x | +6 |
| -60~-31 | 12x | +8 |
| -101~-61 | 16x | +12 |

### 3. robot 机器人配置

| 配置项 | 类型 | 说明 |
|--------|------|------|
| `include_official_robot` | boolean | 是否识别官方机器人 |
| `custom_robots` | array | 自定义机器人 QQ 号列表 |

### 4. rules 规则配置

#### 4.1 moderation 内容审核

| 配置项 | 类型 | 说明 |
|--------|------|------|
| `enabled` | boolean | 是否启用 AI 内容审核 |
| `pool_size` | number | 消息队列大小 |
| `max_await_time` | number | 积攒超时时间（秒） |
| `adj` | string | 审核形容词（如 `tolerant` 宽容） |

#### 4.2 imageBlacklist 图片黑名单

| 配置项 | 类型 | 说明 |
|--------|------|------|
| `enabled` | boolean | 是否启用图片黑名单 |
| `hammingDistanceThreshold` | number | 图片相似度阈值（3-5） |

#### 4.3 humanVerification 人机验证

| 配置项 | 类型 | 说明 |
|--------|------|------|
| `enabled` | boolean | 是否启用人群验证 |
| `maxnum` | number | 题目数值上限 |

#### 4.4 sensitive 敏感词

| 配置项 | 类型 | 说明 |
|--------|------|------|
| `enabled` | boolean | 是否启用敏感词检测 |

### 5. helper 辅助功能

| 配置项 | 类型 | 说明 |
|--------|------|------|
| `admins_group` | number | 管理员群号 |
| `recall_preventer.enabled` | boolean | 是否启用撤回防止器 |

### 6. image_cleanup 图片清理

| 配置项 | 类型 | 说明 |
|--------|------|------|
| `enabled` | boolean | 是否自动清理图片 |
| `retention_days` | number | 图片保留天数 |

## 配置文件模板

完整的配置模板参考以下文件：
- `suanqm-backend/config/config_guide.json` - 所有配置项的中文说明
- `suanqm-backend/config/config.example.json` - 配置文件模板
- `suanqm-backend/.env.example` - 环境变量模板

祝你使用愉快！如有问题，请查看项目 README.md 或提交 Issue。
