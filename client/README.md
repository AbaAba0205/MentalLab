# 心晴客户端

独立的 Next.js 16 / React 网页客户端，保留现有电脑和手机界面。用户必须登录后使用；账户和业务数据通过独立服务器 API 保存。客户端源码不包含数据库、AI 密钥或业务服务端接口。

```sh
cd client
npm ci --workspaces=false
npm run dev
```

默认服务器 `http://127.0.0.1:4000`。复制 `.env.example` 为 `.env.local` 并设置 `SERVER_URL`，该地址只用于 Next.js 服务的 API 代理，不是浏览器直连地址。生产构建前设置它：

```sh
npm run build
npm start
```

服务器需把客户端的完整 Origin（协议、域名、端口）加入 `CLIENT_ORIGINS`。本地以 `http://localhost:3000` 打开，手机访问需添加实际局域网 Origin。生产前端使用 HTTPS；更改服务器地址后需要重新构建客户端。用户数据和 Cookie 均通过客户端同源的 `/api/*` 访问。

`npm run lint`、`npm run typecheck`、`npm test` 可独立执行。`npm run test:e2e` 是整个仓库的集成测试，需要兄弟目录中的服务器已构建，并使用默认 `SERVER_URL` 构建客户端。
