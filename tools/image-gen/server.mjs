import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { generateImage, loadConfig, safeError, status } from './engine.mjs';

const server = new McpServer({ name: 'image_gen', version: '1.0.0' }, {
  instructions: 'Generate or edit MentalLab raster assets with the image_gen tool using Doubao-Seedream-4.0. Default to 2048x2048. Describe subject, style, palette, composition and constraints; use reference_images for style consistency or editing and explicitly preserve invariants. Save project assets inside the project; use .demo-qa/ for experiments. Inspect the returned local file with view_image before delivery. Credentials are loaded locally and must never be requested in chat. This MCP is separate from the built-in image_gen tool and the system imagegen skill.',
});

async function run(operation) {
  let config;
  try {
    config = await loadConfig();
    const result = await operation(config);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  } catch (error) {
    return { isError: true, content: [{ type: 'text', text: safeError(error, config?.apiKey) }] };
  }
}

server.registerTool('image_gen', {
  title: 'Generate or edit an image with Seedream',
  description: 'Generate one raster image or edit local reference images using Doubao-Seedream-4.0. Calls a paid image API. Returns a saved absolute path; inspect it with view_image. Paths are relative to MentalLab or absolute within it. Existing files are never overwritten. Transparent alpha is not guaranteed; inspect outputs.',
  inputSchema: {
    prompt: z.string().min(1).max(12000).describe('Image brief, including exact text if any; for edits specify what changes and what stays fixed.'),
    size: z.string().default('2048x2048').describe('WIDTHxHEIGHT, e.g. 2048x2048, 2560x1440 or 1440x2560. Default 2K.'),
    reference_images: z.array(z.string().min(1)).max(4).optional().describe('Up to four project-local PNG/JPEG/WebP paths, sent to the image provider.'),
    output_path: z.string().min(1).optional().describe('New project-local filename; omit for artifacts/images/seedream-UUID. Extension is adjusted to the actual returned format.'),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
}, input => run(config => generateImage(input, config)));

server.registerTool('image_gen_status', {
  title: 'Check Seedream connection',
  description: 'Check local credentials and model availability without generating or charging for an image.',
  inputSchema: {},
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
}, () => run(config => status(config)));

await server.connect(new StdioServerTransport());
