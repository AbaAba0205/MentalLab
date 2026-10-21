# Seedream 图片生成工具

为 Codex 注册独立的 `image_gen` MCP 服务。它不修改系统 `imagegen` skill，也不是平台内置图片工具。

## 安装与连接

需要 Node.js 24 或更新版本。在仓库根目录执行：

```powershell
npm ci --prefix tools/image-gen
codex mcp add image_gen -- D:\nodejs\node.exe D:\Desktop\MentalLab\tools\image-gen\server.mjs
```

上述路径对应当前机器；换机器时替换为实际绝对路径。安装后在 Codex 设置的 MCP servers 中重启连接，或重启 Codex，再打开项目会话。全局配置仅保存 Node 与脚本路径，不保存 Key。图片生成调用单独计费。

工具每次从仓库根目录 `.env.local` 读取 `AI_API_KEY` 和 `AI_BASE_URL`，缺少时才使用同名环境变量。默认模型固定为 `Doubao-Seedream-4.0`，不会使用聊天的 `AI_MODEL`。可通过 `AI_IMAGE_MODEL` 覆盖；可通过启动环境的 `IMAGE_GEN_ENV_FILE` 指定其他凭据文件。

提供两个 MCP 工具：

- `image_gen_status`：读取模型列表，确认连接与模型权限，不出图。
- `image_gen`：生成一张图片，或使用最多四张本地参考图进行编辑。返回图片绝对路径，再用 `view_image` 检查。

`prompt` 为必填；`size` 默认 `2048x2048`，也可使用 `2560x1440` 或 `1440x2560`；`reference_images` 是项目内的 PNG/JPEG/WebP 文件路径；`output_path` 可指定项目内新文件，默认 `artifacts/images/seedream-UUID` 加实际格式扩展名。工具不覆盖已有文件，并在请求中关闭提供方水印。服务返回 JPEG 时会自动调整文件扩展名，最终以工具返回路径为准。透明背景需检查，模型不保证 alpha。

## 当前会话没有刷新工具时

可直接使用同一实现的 CLI，不需要等待 MCP 加载：

```powershell
node tools/image-gen/cli.mjs status
node tools/image-gen/cli.mjs generate .demo-qa/image-brief.json
```

brief JSON 示例：

```json
{
  "prompt": "为心理练习网站创作原创编辑插画：暖白背景，鼠尾草绿与淡杏色，纸张纹理，柔和日光，简洁留白。没有文字、标志或水印。",
  "size": "2048x2048"
}
```

请先少量试图，确定构图、配色、材质，再用选定图片作参考保持整套资产一致。实验图片保存到 `.demo-qa/`，正式资产保存到项目目录并按需提交。

## 验证

```powershell
npm run check --prefix tools/image-gen
```

离线测试覆盖凭据读取、API 请求、参考图编码、文件保存、错误脱敏、下载时不传 Key、禁止覆盖和 MCP STDIO 握手。真实出图需显式执行 CLI 或 MCP 调用；自动测试不消费图片额度。
