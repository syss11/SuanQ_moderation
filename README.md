# SuanQm！群聊管理系统

## 项目简介

通过信誉分系统与多种功能进行群聊管理的机器人项目，基于NapCat Typescript SDK。

配置自由度高，附带WebUI，可多群管理

可以配置AI人设回复与审核功能

## 项目功能
1. 信誉分（积分）系统-影响判罚数值，可设置踢出下限
2. 刷屏检测-时间窗口算法，多种行为（重复消息）可累计权重，判定灵活
3. 内容审核-默认关闭，使用累计防抖机制提升AI效率，具体效果取决于接入模型
4. 封禁图片/表情-pHash相似度判断，管理员可全局屏蔽图片
5. 铭感词过滤-默认暂无词库，可命令添加，简易包含匹配
6. 入群人机验证-数学题追验，杜绝人机入群
7. 群组黑白名单/权限检查/机器人识别等实用功能
8. AI人设，模型配置-结合判罚生成回复，好玩的管理员
9. 签到与互动-提升活跃度，互动影响积分
10. webui-图形界面直观管理，另可用指令高效管理。
11. 高度可配置-自动文档化，生成群规供查询

## 部署条件
1. （比如你作为群主）机器人拥有管理员权限
2. 若需要持续运行，则可能需要服务器
3. 估算内存消耗不大，整体为异步并行

## 部署步骤

# 普通部署
1. 安装Node.js [https://nodejs.org/zh-cn/download/](https://nodejs.org/zh-cn/download/)-本项目使用nvm+pnpm（npm也可），建议最新版本
2. 克隆项目到本地 `git clone (项目地址.git)`
3. 进入项目目录的suanqm-backend部分，运行 `pnpm install` 安装依赖
4. 按napcat连接指导配置napcat连接配置（config/config.json）
5. 运行 `pnpm run build` 编译项目，运行 `pnpm run start` 启动项目
6. 等待启动，若出现问题，参考日志输出
7. 发送test可测试（保证群聊已配置白名单，或不在黑名单里）

# Docker部署
1. 确保安装了docker（windows本步骤较麻烦）
2. 按napcat连接指导配置napcat连接配置（config/config.json）
3. 直接在项目根目录运行 `docker-compose up -d --build` 启动项目
4. 等待启动，若出现问题，参考日志输出（`docker compose logs`）
5. 发送test可测试（保证群聊已配置白名单，或不在黑名单里）


# NcpCat连接指导
1. 安装并启动napcat（具体看napcat文档，可用docker）
2. 配置napcat连接配置，通常在Napcat WebUI网络配置
3. 配置”WS服务端“，端口默认3000，记录access token。
4. 启动服务，回到项目config，填入access token，端口等。
5. host项：若非docker，则为127.0.0.1，若docker，则可查询docker网络等知识推导服务访问地址
6. 启动项目，若连接失败，则程序直接终止。

# 密码机制
项目采用自动密码生成机制，确保安全性：

### AUTH_PASSWORD（管理后台密码）
- **用途**：用于登录 WebUI 管理后台
- **生成时机**：首次启动时自动生成
- **存储位置**：`suanqm-backend/.env` 文件
- **查看方式**：启动时在控制台日志中显示

### SQLITE_WEB_PASSWORD（数据库管理密码）
- **用途**：用于访问 SQLite Web 数据库管理界面（仅 Docker 部署）
- **生成时机**：首次 Docker 启动时自动生成
- **存储位置**：`suanqm-backend/.env` 文件
- **查看方式**：容器启动时在日志中显示

# WebUI使用
1. 检查`suanqm-frontend\.env.production`，若非本机部署，改为服务的IP+端口。
2. 检查`suanqm-backend\.env.production`，若非本机部署，改为服务的IP+端口。
3. 若Docker部署，跳过4，5，6步骤。
4. 进入suanqm-frontend目录，运行 `npm install` 安装依赖
5. 运行 `npm run build` 编译项目，找到dist文件夹
6. 将dist复制到`suanqm-backend\public\`下
7. 重启项目，默认端口6065（本机http://localhost:6065, 若docker部署，需映射端口...）

# 技术与声明
1. 项目基础：Napcat Node.js
2. 项目语言： TypeScript
3. 项目技术：TypeORM，Express，Vue等
4. 作者水平：仍需提升。若存在bug可反馈
5. AI率：中。多数架构与细节受过优化，且经过测试。
6. 本项目仅供学习与日常实用，不建议专业使用或用于不恰当用途。