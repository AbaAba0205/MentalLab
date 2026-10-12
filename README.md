# 心屿 MentalLab

面向青少年的心理健康技能练习平台，采用 Next.js App Router、React、TypeScript 和 Tailwind CSS，电脑与手机共享一套响应式网页。

当前 MVP 已具备签到、三种分步练习、三轮 AI 情境练习、安全中断、复盘及记录管理。填入服务端 API 配置后可调用真实模型；未配置或调用失败时会明确切换到预设情境。账号和云端数据库尚未接入。产品技术方案及实施阶段见 [技术设计](docs/技术设计.md)。

## 本地开发

使用 Node.js 22 LTS 或更新的受支持版本，推荐 Node.js 24 LTS。

```sh
npm ci
npm run dev
```

打开 http://localhost:3000。手机与电脑处于同一局域网时，可通过 `http://电脑的局域网IP:3000` 访问，需要本机防火墙允许该端口。

## 生产构建

```sh
npm run build
npm start
```

默认端口为 3000，可使用 `npm start -- --port 3100` 指定端口。正式托管应配置 HTTPS；当前前端与健康检查可以直接运行，不需要 API 密钥或数据库配置。

## 配置 AI

项目根目录已经创建本地配置文件 `.env.local`，填写以下两项后重启开发服务器：

```dotenv
AI_API_KEY=
AI_BASE_URL=
AI_MODEL=Qwen3.5-27B
```

`AI_BASE_URL` 使用 OpenAI 兼容接口的基础地址，例如以 `/v1` 结尾；代码会追加 `/chat/completions`。如果服务商提供的是完整的 `/chat/completions` 地址，也可直接填写。密钥不使用 `NEXT_PUBLIC_` 前缀，只在服务端读取。可提交的空白模板位于 `.env.example`，`.env.local` 已被 Git 忽略。

## 功能与数据边界

- 首次使用说明、情绪签到与预设推荐、接地练习、想法整理、考试前的小计划、练习反馈与复盘。
- 三轮“向同学表达边界”情境练习；服务端调用 OpenAI 兼容模型，超时、异常或未配置时使用有明确标签的预设情境。
- 每轮情境输入先执行服务端安全分流，命中明确风险表达时停止普通练习并打开现实支持；当前规则仍是 MVP 安全层，不等同于临床风险评估。
- 保留原有淡紫与浅蓝风格、桌面侧栏与手机底部导航。
- 记录保存在当前浏览器的 `mind-island-demo-v1`，兼容迁移前的有效记录；更换域名、协议或端口会使用另一个浏览器存储空间，不会自动迁移。两个设备目前不会同步。
- 首次访问提供两条标有“示例”的模拟记录；清空后刷新不会再次生成。用户输入作为文本显示。
- 本地数据未经加密，同一浏览器的使用者可能看到记录。请用虚构内容体验，真实未成年人试用前需要完成专业审核、隐私与授权流程。
- 普通推荐和固定练习由预设规则驱动；AI 只用于标有“AI 情境练习”的功能。安全分支可能误判或漏判，不构成临床风险评估。帮助页没有真人值守，也不会自动拨号、通知或执行专业转介。
- `GET /api/health` 显示模型是否已配置及当前模型名，不返回密钥或 Base URL。

## 测试与验证

```sh
npm run check
npx playwright install chromium
npm run test:e2e
```

`check` 顺序执行 ESLint、类型检查、单元测试和生产构建。端到端测试自动启动生产服务，使用独立浏览器环境，覆盖桌面及手机尺寸，不读取日常浏览器记录。测试端口 3100 必须空闲。

若使用已安装的 Chrome，可在 PowerShell 中执行：

```powershell
$env:PLAYWRIGHT_CHANNEL = 'chrome'
npm run test:e2e
```

截图与失败 trace 输出至 `test-results/`（Git 忽略）。GitHub Actions 配置相同的检查及 Chromium 测试；需要推送后才会在远端执行。

## 工程结构

```text
src/app/                 页面入口、布局、样式与服务端接口
src/app/api/health/      服务健康检查
src/app/api/scenario/    AI 情境练习服务端接口
src/components/         React 界面、弹窗、计时器及图标
src/lib/                练习内容、记录类型与纯函数
src/server/             模型适配和服务端限流
public/                 静态插画
test/                   单元与端到端测试
docs/技术设计.md         技术决策、目标架构、迭代计划及验收标准
```

旧的根目录静态入口与静态服务器已由 Next.js 取代。所有改动需更新相关测试、通过验证并创建对应 Git commit。
