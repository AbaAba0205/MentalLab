# 心屿 MentalLab

面向青少年的心理健康技能练习平台，采用 Next.js App Router、React、TypeScript 和 Tailwind CSS，电脑与手机共享一套响应式网页。

当前版本为正式工程的开发预览：已经迁移原有签到、三种分步练习、计时器、复盘及记录管理；尚未接入真实 AI、账号或云端数据库。产品技术方案及实施阶段见 [技术设计](docs/技术设计.md)。

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

## 功能与数据边界

- 情绪签到与预设推荐、接地练习、想法整理、考试前的小计划、练习反馈与复盘。
- 保留原有淡紫与浅蓝风格、桌面侧栏与手机底部导航。
- 记录保存在当前浏览器的 `mind-island-demo-v1`，兼容迁移前的有效记录；更换域名、协议或端口会使用另一个浏览器存储空间，不会自动迁移。两个设备目前不会同步。
- 首次访问提供两条标有“示例”的模拟记录；清空后刷新不会再次生成。用户输入作为文本显示。
- 本地数据未经加密，同一浏览器的使用者可能看到记录。请用虚构内容体验，真实未成年人试用前需要完成专业审核、隐私与授权流程。
- 推荐、引导与帮助分支均为预设规则。关键词分支可能误判或漏判，不构成真实危机检测。帮助页没有真人值守，也不会自动拨号、通知或执行专业转介。
- `GET /api/health` 显示服务及集成状态，明确返回 AI 尚未配置、存储位于浏览器。

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
src/components/         React 界面、弹窗、计时器及图标
src/lib/                练习内容、记录类型与纯函数
public/                 静态插画
test/                   单元与端到端测试
docs/技术设计.md         技术决策、目标架构、迭代计划及验收标准
```

旧的根目录静态入口与静态服务器已由 Next.js 取代。所有改动需更新相关测试、通过验证并创建对应 Git commit。
