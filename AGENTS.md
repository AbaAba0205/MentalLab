# 注意事项

- 每次改动完成后，都必须创建一个对应的 Git commit，以便后续追踪和回滚。
- 每次改动后，都必须编写或更新相关测试，并在交付给用户前，确保所有测试和验证全部通过。

## 项目图片生成

- 本项目已接入 Seedream 的独立 `image_gen` MCP 服务，默认模型 `Doubao-Seedream-4.0`。生成或编辑位图时，使用该服务的 `image_gen` 工具；可先用 `image_gen_status` 检查连接。
- 该服务与系统 `imagegen` skill、平台内置 `image_gen` 是不同能力。当前会话若未加载 MCP，可使用 `node tools/image-gen/cli.mjs generate <brief.json>`，这是用户已授权配置的 Seedream API 路径。详见 `tools/image-gen/README.md`。
- 工具读取根目录 `.env.local` 中的 `AI_API_KEY`、`AI_BASE_URL`；不得输出、提交凭据或将其发送给图片下载 CDN。不得改用聊天的 `AI_MODEL` 生成图片。
- 默认生成 2K 图片；参考图需说明用途，编辑需明确保持不变的内容。生成后用 `view_image` 检查效果。正式资产保存到项目内，试验图片保存到 `.demo-qa/`，不得覆盖现有资产。

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
