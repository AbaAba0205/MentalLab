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

`AI_API_KEY`、`AI_BASE_URL` 和可选 `AI_MODEL` 只在本项目读取。未配置时使用有标记的预设回应。

这是适用于单实例部署的 SQLite 实现。多主机、多副本部署应先迁移到共享数据库；当前并非实时协作同步。备份时使用 SQLite 在线备份工具，或停服后复制数据库及需要的 WAL 文件；恢复时停服替换文件后重启。文件权限、磁盘/备份加密及保留周期由部署环境配置。

`AUTH_IP_LIMIT` 可覆盖每来源 IP 15 分钟的认证次数（默认 40）；按邮箱另限 15 次。集成测试为大量隔离测试账户提高 IP 上限。服务使用真实连接地址计数，不信任可伪造的 `X-Forwarded-For`；经客户端代理后多个用户可能共享该 IP，部署时按实际规模配置上限。

```sh
npm run typecheck
npm test
```

测试使用内存/临时数据库和模拟 AI，不读取实际数据库或发送真实 AI 请求。
