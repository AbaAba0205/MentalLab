# 心晴服务器

独立的 Node.js 24 + TypeScript 服务，提供 API、SQLite 持久化和 `/admin` 管理网站。没有 Next.js 或客户端项目的运行依赖。

```sh
cd server
npm ci --workspaces=false
npm run dev
```

复制 `.env.example` 为 `.env.local` 配置环境；生产运行：

```sh
npm run build
npm start
```

默认监听 4000；数据库默认 `server/data/xinqing.sqlite`（路径相对服务器进程工作目录）。数据库包含账户、会话、记录、对话、配置和操作日志，不应放入公开目录或版本控制。`config/reminders.json` 只作为首次建库默认值，后续由管理后台修改数据库。

创建管理员：在服务器 `.env.local` 或进程环境配置 `ADMIN_EMAIL`、`ADMIN_NAME`、`ADMIN_PASSWORD` 后运行 `npm run admin:create`。密码需 10–128 位，邮箱必须未被注册。公开注册不接受管理员角色。创建后移除管理员密码环境配置，登录 [http://localhost:4000/admin](http://localhost:4000/admin)。服务器不会自动创建默认管理员。

部署时设置 `CLIENT_ORIGINS` 为允许的客户端 Origin，以逗号分隔；服务器与客户端均使用 HTTPS，设置 `COOKIE_SECURE=true`。`HOST` 可设为 `127.0.0.1` 并通过反向代理开放 `/admin`；无需对浏览器开放跨域 API，客户端由 Next.js 同源代理。反向代理应保留原始 Origin、限制请求体和连接数，并按部署策略限制管理站点访问。

当前 FRP 临时测试地址为 `https://frp-off.com:58801`。在服务器 `.env.local` 中设置以下白名单并重启服务器，才能通过公网注册、登录及保存数据：

```dotenv
CLIENT_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,https://frp-off.com:58801
```

Origin 必须包含协议、域名和端口，末尾不加 `/`；隧道地址变化后需同步更新。客户端 `allowedDevOrigins` 仅允许 Next.js 开发连接，不能替代后端白名单。只穿透客户端 3000 端口即可，由 Next.js 代理 `/api/*` 到本机后端；不要关闭来源校验或信任浏览器提供的转发头。

`AI_API_KEY`、`AI_BASE_URL` 和可选 `AI_MODEL` 只在本项目读取。未配置时使用有标记的预设回应。

## AI 诊断日志

随心聊和情境练习默认向服务器终端（标准输出）写入单行 JSON，`component` 为 `xinqing-ai`。日志不记录用户消息、模型回复、提示词、请求头、Cookie、API Key、上游地址或异常原文。日志不写入账户数据库；需要跨重启保存时，由进程托管工具采集标准输出。

浏览器开发者工具的 Network 面板中，找到 `/api/chat/turn` 或 `/api/scenario/turn`，复制响应头 `X-Request-Id`，即可在服务器日志中定位本次调用。ID 由服务器生成，不接受浏览器提交的自定义 ID。鉴权失败、请求格式错误和限流也带有该响应头。

同一 `requestId` 的日志按以下顺序出现：`ai_http` 的 `started` 事件 → 每次模型尝试的 `ai_attempt` → 最终 `ai_request` 结果 → `ai_http` 完成事件。模型调用前被拒绝的请求只有 HTTP 事件；本地安全中断没有模型尝试。`attempt` 从 1 开始，随心聊最多尝试 2 次。`durationMs` 单位为毫秒，分别统计尝试、生成回复和整个 API 请求的耗时。`responseStatus` 是本地 API 的 HTTP 状态；`providerStatus` 在上游 HTTP/响应体错误且已收到响应头时记录上游状态。

| reason | 含义 |
| --- | --- |
| `provider_not_configured` / `provider_config` | AI 配置缺失 / 地址格式不正确 |
| `provider_timeout` | 调用或读取响应体超时 / 被中止 |
| `provider_network` | 网络连接或响应流读取失败 |
| `provider_http` | 上游返回非 2xx；结合 `providerStatus` 区分 401、429、5xx |
| `provider_invalid_response` | 上游响应不是有效 JSON 或缺少模型内容 |
| `invalid_json` / `invalid_schema` | 模型内容不是所需 JSON / 必需字段不合格 |
| `response_too_long` / `unsafe_text` | 回复超过长度 / 文本规则校验未通过 |
| `ineligible_exercise` | 推荐的训练不符合当前用户意愿或强度要求 |
| `rate_limited` | 本地限流；不会调用模型 |
| `authentication_required` / `request_forbidden` / `invalid_request` | 未登录 / 不允许的请求来源 / 请求格式错误 |
| `internal_error` | 本地 API 内部异常 |
| `local_safety_handoff` / `model_safety_handoff` | 本地规则 / 模型触发现实支持 |
| `fallback` | 两次尝试均未通过，使用预设回应；查看同 ID 的尝试日志确定具体原因 |

例如日志中同一 ID 连续出现 `provider_http`、`providerStatus: 429`，说明上游限流；若 `responseStatus: 200` 但 `ai_request` 为 `fallback`，说明本地 API 正常完成并使用了预设回应。仅有 `ai_http: started` 而没有完成记录，需检查进程是否重启或中断。HTTP 完成事件表示服务器已生成响应，不保证浏览器仍在等待该响应。

此次改动只增加诊断，不调整原有重试、安全规则及时间限制：单次模型请求仍为 15 秒，随心聊最多两次，浏览器等待上限仍为 22 秒。因此可能出现服务器继续处理时浏览器已中止等待的情况；旧请求无法事后补录日志。

这是适用于单实例部署的 SQLite 实现。多主机、多副本部署应先迁移到共享数据库；当前并非实时协作同步。备份时使用 SQLite 在线备份工具，或停服后复制数据库及需要的 WAL 文件；恢复时停服替换文件后重启。文件权限、磁盘/备份加密及保留周期由部署环境配置。

`AUTH_IP_LIMIT` 可覆盖每来源 IP 15 分钟的认证次数（默认 40）；按邮箱另限 15 次。集成测试为大量隔离测试账户提高 IP 上限。服务使用真实连接地址计数，不信任可伪造的 `X-Forwarded-For`；经客户端代理后多个用户可能共享该 IP，部署时按实际规模配置上限。

```sh
npm run typecheck
npm test
```

测试使用内存/临时数据库和模拟 AI，不读取实际数据库或发送真实 AI 请求。
