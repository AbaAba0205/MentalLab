import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { generateImage, endpoint, loadConfig, safeError, status } from '../engine.mjs';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII=', 'base64');
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'mentallab-image-gen-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return { root, apiKey: 'test-secret', baseUrl: 'https://provider.example', model: 'Doubao-Seedream-4.0' };
}
const response = () => Response.json({ data: [{ b64_json: png.toString('base64') }] });

test('API paths preserve v1 and custom provider prefixes', () => {
  assert.equal(endpoint('https://example.com/', 'models'), 'https://example.com/v1/models');
  assert.equal(endpoint('https://example.com/v1/', 'images/generations'), 'https://example.com/v1/images/generations');
  assert.equal(endpoint('https://example.com/api/v3', 'models'), 'https://example.com/api/v3/models');
  assert.throws(() => endpoint('http://example.com', 'models'), /HTTPS/);
});

test('loads project credentials without using text chat AI_MODEL', async t => {
  const config = await fixture(t);
  await writeFile(join(config.root, '.env.local'), 'AI_API_KEY="file-secret"\nAI_BASE_URL=https://example.com/v1\nAI_MODEL=chat-only\n');
  const loaded = await loadConfig({ root: config.root, env: { AI_API_KEY: 'inherited-secret' } });
  assert.equal(loaded.apiKey, 'file-secret');
  assert.equal(loaded.model, 'Doubao-Seedream-4.0');
  await assert.rejects(loadConfig({ root: join(config.root, 'missing'), env: {} }), /Configure/);
});

test('sends exact model, auth, 2K size and persists valid image', async t => {
  const config = await fixture(t);
  const result = await generateImage({ prompt: '  A calming illustration  ' }, config, async (url, options) => {
    assert.equal(url, 'https://provider.example/v1/images/generations');
    assert.equal(options.headers.Authorization, 'Bearer test-secret');
    assert.equal(options.redirect, 'error');
    assert.deepEqual(JSON.parse(options.body), { model: 'Doubao-Seedream-4.0', prompt: 'A calming illustration', size: '2048x2048', n: 1, response_format: 'b64_json' });
    return response();
  });
  assert.deepEqual(await readFile(result.path), png);
  assert.equal(result.mimeType, 'image/png');
  assert.ok(result.path.startsWith(config.root));
});

test('reference edits send local files as image data', async t => {
  const config = await fixture(t);
  await writeFile(join(config.root, 'reference.png'), png);
  await generateImage({ prompt: 'Change only the sky', reference_images: ['reference.png'] }, config, async (_, options) => {
    assert.equal(JSON.parse(options.body).image, `data:image/png;base64,${png.toString('base64')}`);
    return response();
  });
});

test('invalid prompts, sizes and paths fail before API spending', async t => {
  const config = await fixture(t);
  let calls = 0;
  const request = async () => { calls++; return response(); };
  for (const input of [{ prompt: '' }, { prompt: 'x', size: '512x512' }, { prompt: 'x', size: 'auto' }, { prompt: 'x', output_path: '../outside.png' }, { prompt: 'x', reference_images: ['../outside.png'] }]) {
    await assert.rejects(generateImage(input, config, request));
  }
  assert.equal(calls, 0);
});

test('existing output is never overwritten', async t => {
  const config = await fixture(t);
  await writeFile(join(config.root, 'existing.png'), 'keep');
  await assert.rejects(generateImage({ prompt: 'x', output_path: 'existing.png' }, config, () => { assert.fail('must not spend on existing output'); }), /exist/i);
  assert.equal(await readFile(join(config.root, 'existing.png'), 'utf8'), 'keep');
});

test('provider JPEG output corrects the filename extension automatically', async t => {
  const config = await fixture(t);
  const jpeg = Buffer.from([255, 216, 255, 224]);
  const result = await generateImage({ prompt: 'x', output_path: 'preview.png' }, config, async () => Response.json({ data: [{ b64_json: jpeg.toString('base64') }] }));
  assert.equal(result.path, join(config.root, 'preview.jpg'));
  assert.deepEqual(await readFile(result.path), jpeg);
});

test('paths through an external directory link are rejected before API use', async t => {
  const config = await fixture(t);
  const outside = await fixture(t);
  await symlink(outside.root, join(config.root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(generateImage({ prompt: 'x', output_path: 'linked/test.png' }, config, () => assert.fail('must not call API')), /outside/);
});

test('CDN downloads never receive provider credentials', async t => {
  const config = await fixture(t);
  let count = 0;
  const result = await generateImage({ prompt: 'x' }, config, async (url, options) => {
    if (++count === 1) return Response.json({ data: [{ url: 'https://cdn.example/asset.png' }] });
    assert.equal(String(url), 'https://cdn.example/asset.png');
    assert.equal(options.headers, undefined);
    assert.equal(options.redirect, 'error');
    return new Response(png);
  });
  assert.deepEqual(await readFile(result.path), png);
});

test('bad images, absent output and HTTP failures surface clear errors without keys', async t => {
  const config = await fixture(t);
  await assert.rejects(generateImage({ prompt: 'x' }, config, async () => Response.json({ data: [{ b64_json: 'bm90LWFuLWltYWdl' }] })), /supported/);
  await assert.rejects(generateImage({ prompt: 'x' }, config, async () => Response.json({ data: [] })), /no image/);
  await assert.rejects(generateImage({ prompt: 'x' }, config, async () => Response.json({ error: { message: 'bad test-secret' } }, { status: 401 })), error => error.message.includes('401') && !error.message.includes('test-secret'));
  assert.equal(safeError(new Error('test-secret'), config.apiKey), '[REDACTED]');
});

test('status checks model availability without image generation', async t => {
  const config = await fixture(t);
  const result = await status(config, async (url, options) => {
    assert.equal(url, 'https://provider.example/v1/models');
    assert.equal(options.method, 'GET');
    return Response.json({ data: [{ id: 'Doubao-Seedream-4.0' }] });
  });
  assert.equal(result.available, true);
  assert.equal(JSON.stringify(result).includes(config.apiKey), false);
});

test('real STDIO handshake advertises image_gen tools and rejects invalid input', async t => {
  const client = new Client({ name: 'image-gen-test', version: '1.0.0' });
  const transport = new StdioClientTransport({ command: process.execPath, args: [fileURLToPath(new URL('../server.mjs', import.meta.url))], cwd: resolve(tmpdir()) });
  t.after(() => client.close());
  await client.connect(transport);
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map(item => item.name).sort(), ['image_gen', 'image_gen_status']);
  assert.equal(tools.find(item => item.name === 'image_gen').annotations.readOnlyHint, false);
  assert.match(client.getInstructions(), /Doubao-Seedream-4.0/);
  const invalid = await client.callTool({ name: 'image_gen', arguments: { prompt: '' } });
  assert.equal(invalid.isError, true);
});
