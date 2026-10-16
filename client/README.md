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

`npm run lint`、`npm run typecheck`、`npm test` 可独立执行。`npm run test:e2e` 是整个仓库的集成测试，需要兄弟目录中的服务器已构建。测试自动将客户端构建到 `.next-e2e` 并代理专用的 4100 端口，不影响开发服务的构建目录。

随心聊会话列表位于桌面左侧栏；手机通过聊天上方“选择会话”展开。支持新建、切换和确认删除会话，首条消息自动成为标题。服务器保存每个会话及上次选择；切换保留当前页面未发送的草稿。正在回复、执行训练或保存失败时，需要先完成/停止操作或重试保存再切换。
