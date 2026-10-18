# 心晴

项目已拆为两个可分别安装、构建和部署的项目：`client/` 是原有 Next.js 客户端，`server/` 是独立的 Node.js API、SQLite 数据库与管理员网站。根目录仅提供同时开发和验证的便捷命令。

## 开发

需要 Node.js 24 或更新版本。项目使用 Node 内置 SQLite，无需另外安装数据库。

```sh
npm ci
npm run dev
```

- 客户端：[http://localhost:3000](http://localhost:3000)
- 服务器及管理后台：[http://localhost:4000/admin](http://localhost:4000/admin)

也可以开两个终端分别执行 `npm run dev:client`、`npm run dev:server`。独立运行和部署说明见 [客户端说明](client/README.md) 与 [服务器说明](server/README.md)。

## 配置

将 `client/.env.example`、`server/.env.example` 分别复制为相同目录下的 `.env.local`。默认本机运行无需额外配置。原项目已有的 AI 本地配置在本次拆分中已复制到 `server/.env.local`，以后只修改服务器内的配置。

客户端只配置 `SERVER_URL`；AI 密钥、管理员凭据和数据库路径只放服务器。客户端通过 `/api/*` 代理访问服务器，无需将登录令牌暴露给 JavaScript。`SERVER_URL` 会写入 Next.js 构建产物，部署前应配置正确地址并重新构建。

管理员不是首个注册者，也没有公开注册入口。在服务器环境配置 `ADMIN_EMAIL`、`ADMIN_NAME`、`ADMIN_PASSWORD`（10–128 位），然后执行：

```sh
npm run admin:create --workspace server
```

创建成功后移除 `ADMIN_PASSWORD`，使用该账户登录管理后台。公开注册始终创建普通用户。

## 数据与功能

- 客户端保留随心聊、课程预留、签到、四类 DBT 技能的 4 个独立讲解模块和 23 个小练习（参与 6、观察 6、智慧心 6、描述 5）、情境练习和记录管理；先注册或登录后使用。
- 用户、密码哈希、会话、练习记录、随心聊对话、最近一次情境对话、使用说明确认、提醒配置和管理员操作日志保存在服务器 SQLite 中。
- 密码使用带独立随机盐的 scrypt；登录会话使用随机令牌，数据库只存令牌摘要，浏览器通过 HttpOnly / SameSite Cookie 维持登录。会话七天过期；退出、停用及删除账户会撤销相应会话。
- 随心聊支持新建、切换和删除会话，标题取自第一条消息，桌面在左侧选择，手机通过“选择会话”展开。各会话的消息及模型上下文独立，单个会话最多保留最近 200 条消息；刷新后恢复上次选择的会话。旧版单条聊天历史自动迁移为一个会话。
- 同一账户可在多个设备登录，重新打开页面从服务器加载数据；其他已打开的页面需刷新读取最新数据。切换时保留本次页面中的未发送草稿，刷新后草稿不保留。
- API 按登录用户限定数据范围。后台支持查看、停用/启用/删除普通用户，查看和删除练习记录，查看/清空对话，修改侧栏提醒，并记录管理操作。用户/记录最多显示最近 500 项，对话最近 200 项，可按内容筛选。
- 新账户从空记录开始。旧版浏览器记录不会自动归属某个账户；在“我的记录”主动点击“导入此浏览器的旧版个人记录”，成功后移除浏览器副本。示例和损坏记录不导入，重复导入按记录 ID 去重。
- 新数据不写入 localStorage。填写但尚未保存的练习草稿仍属于当前页面；完成保存后才写入服务器。聊天保存失败会提示重试；练习保存失败保留表单，不显示成功状态。
- 随心聊和情境练习会把主动发送的内容及必要近期对话交给配置的 AI 服务；未配置时保留明确标注的预设回应。原有风险中断和现实支持入口继续保留。

## 构建和验证

```sh
npm run check
npx playwright install chromium
npm run test:e2e
```

`check` 执行客户端 ESLint、两端类型检查、两端单元/API 测试与生产构建。浏览器测试自动在 `.next-e2e` 独立构建客户端，启动客户端 3100 和服务器 4100，使用系统临时目录中的专用数据库和测试管理员，禁用真实 AI 调用。这两个测试端口需要空闲，可与开发服务 3000/4000 并行运行。已有 Chrome 时可以设置 `PLAYWRIGHT_CHANNEL=chrome`。

独立项目可分别执行 `npm ci --workspaces=false` 后构建。生产环境分别启动两个项目并维护服务器数据卷，详见各自 README。

## 结构

```text
client/                 原有界面、注册登录、账户数据接入
  src/app/              Next.js 页面与样式（无业务 API）
  src/components/       React 交互界面
  src/lib/              客户端模型、内容与协议校验
  test/                 客户端单元及双端集成浏览器测试
server/                 独立服务器项目
  src/application.ts    鉴权、授权、记录、配置、管理 API
  src/database.ts       SQLite schema、会话和持久化
  src/server/           AI 适配和安全响应
  public/               管理员基本页面
  config/               首次建库的提醒默认值
  test/                 API、安全、数据库及 AI 测试
scripts/                同时启动与集成测试辅助
docs/客户端与服务器拆分.md 当前架构、接口与部署说明
```

原有设计资料保留为历史背景；当前实现以本 README 和拆分说明为准。所有改动均需更新测试、验证通过并创建 Git commit。
