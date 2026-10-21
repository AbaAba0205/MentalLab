import { readFile, mkdir, writeFile, realpath, access } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { resolve, relative, isAbsolute, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

export const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
export const defaultModel = 'Doubao-Seedream-4.0';
const maxImageBytes = 30 * 1024 * 1024;

export function endpoint(base, resource) {
  const url = new URL(base);
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new Error('AI_BASE_URL must use HTTPS.');
  }
  if (url.username || url.password || url.search || url.hash) throw new Error('AI_BASE_URL must not contain credentials, query or fragment.');
  const prefix = url.pathname.replace(/\/+$/, '') || '/v1';
  url.pathname = `${prefix}/${resource}`;
  return url.href;
}

export async function loadConfig({ root = projectRoot, env = process.env } = {}) {
  const envFile = env.IMAGE_GEN_ENV_FILE || resolve(root, '.env.local');
  let local = {};
  try { local = parseEnv(await readFile(envFile, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw new Error('Cannot read image generation environment file.'); }
  // The explicitly selected file takes precedence over inherited chat-provider credentials.
  const apiKey = local.AI_API_KEY || env.AI_API_KEY;
  const baseUrl = local.AI_BASE_URL || env.AI_BASE_URL;
  if (!apiKey || !baseUrl) throw new Error('Configure AI_API_KEY and AI_BASE_URL in the project .env.local.');
  endpoint(baseUrl, 'images/generations');
  return { root, apiKey, baseUrl, model: local.AI_IMAGE_MODEL || env.AI_IMAGE_MODEL || defaultModel };
}

function insideRoot(root, path) {
  const target = resolve(root, path);
  const rel = relative(root, target);
  if (!rel || rel === '..' || rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) || isAbsolute(rel)) {
    throw new Error('Image paths must stay inside the project directory.');
  }
  return target;
}

async function checkedPath(root, path, mustBeNew = false) {
  const target = insideRoot(root, path);
  const canonicalRoot = await realpath(root);
  let existing = target;
  while (true) {
    try {
      const canonical = await realpath(existing);
      const rel = relative(canonicalRoot, canonical);
      if (rel === '..' || rel.startsWith('..\\') || rel.startsWith('../') || isAbsolute(rel)) throw new Error('Image paths must not follow links outside the project.');
      break;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      existing = dirname(existing);
    }
  }
  if (mustBeNew) {
    try { await access(target); }
    catch (error) { if (error.code === 'ENOENT') return target; throw error; }
    throw new Error('Output file already exists; choose a new filename.');
  }
  return target;
}

function imageType(bytes) {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { mime: 'image/png', ext: '.png' };
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return { mime: 'image/jpeg', ext: '.jpg' };
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return { mime: 'image/webp', ext: '.webp' };
  throw new Error('Provider did not return a supported PNG, JPEG or WebP image.');
}

export function safeError(error, apiKey) {
  const message = error instanceof Error ? error.message : String(error);
  return (apiKey ? message.split(apiKey).join('[REDACTED]') : message).slice(0, 600);
}

async function providerJson(config, resource, options, request) {
  let response;
  try {
    response = await request(endpoint(config.baseUrl, resource), {
      ...options,
      headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(240_000),
      redirect: 'error',
    });
  } catch { throw new Error('Image provider request failed or timed out; check connectivity.'); }
  if (!response.ok) {
    let detail = '';
    try {
      const body = await response.json();
      detail = typeof body.error?.message === 'string' ? body.error.message : '';
    } catch { /* Do not expose arbitrary proxy HTML or request headers. */ }
    throw new Error(safeError(new Error(`Image provider HTTP ${response.status}${detail ? `: ${detail}` : ''}`), config.apiKey));
  }
  return response.json();
}

export async function status(config, request = fetch) {
  const body = await providerJson(config, 'models', { method: 'GET' }, request);
  const available = (body.data || []).some(item => item.id === config.model);
  return { model: config.model, available, credentialsConfigured: true };
}

export async function generateImage(input, config, request = fetch) {
  const { prompt, size = '2048x2048', reference_images = [], output_path } = input;
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 12000) throw new Error('Prompt must contain 1–12000 characters.');
  if (!/^\d+x\d+$/.test(size)) throw new Error('Size must use WIDTHxHEIGHT.');
  const [width, height] = size.split('x').map(Number);
  if (width < 512 || height < 512 || width > 4096 || height > 4096 || width * height < 921600 || width * height > 16777216 || Math.max(width / height, height / width) > 3) {
    throw new Error('Seedream size must have 512–4096px edges, 0.92–16.77 megapixels and at most a 3:1 ratio.');
  }
  if (!Array.isArray(reference_images) || reference_images.length > 4) throw new Error('Use at most four reference images.');
  // Validate output before making a paid API request.
  if (output_path) {
    if (!['.png', '.jpg', '.jpeg', '.webp'].includes(extname(output_path).toLowerCase())) throw new Error('Output filename must use .png, .jpg, .jpeg or .webp.');
    await checkedPath(config.root, output_path, true);
  }
  const images = [];
  for (const path of reference_images) {
    const bytes = await readFile(await checkedPath(config.root, path));
    if (bytes.length > maxImageBytes) throw new Error('Reference image exceeds 30 MiB.');
    images.push(`data:${imageType(bytes).mime};base64,${bytes.toString('base64')}`);
  }
  const body = {
    model: config.model, prompt: prompt.trim(), size, n: 1, response_format: 'b64_json',
    ...(images.length ? { image: images.length === 1 ? images[0] : images } : {}),
  };
  const result = await providerJson(config, 'images/generations', { method: 'POST', body: JSON.stringify(body) }, request);
  const item = result.data?.[0];
  let bytes;
  if (typeof item?.b64_json === 'string') {
    if (item.b64_json.length > Math.ceil(maxImageBytes / 3) * 4) throw new Error('Generated image exceeds 30 MiB.');
    bytes = Buffer.from(item.b64_json, 'base64');
  } else if (typeof item?.url === 'string') {
    const url = new URL(item.url);
    if (url.protocol !== 'https:') throw new Error('Provider image download URL must use HTTPS.');
    // Generated file URLs can be on a separate CDN. Never forward the API key.
    const download = await request(url, { signal: AbortSignal.timeout(60_000), redirect: 'error' });
    if (!download.ok) throw new Error(`Generated image download HTTP ${download.status}.`);
    const chunks = [];
    let count = 0;
    for await (const chunk of download.body) {
      count += chunk.length;
      if (count > maxImageBytes) throw new Error('Generated image exceeds 30 MiB.');
      chunks.push(chunk);
    }
    bytes = Buffer.concat(chunks);
  } else { throw new Error('Provider response contains no image.'); }
  const type = imageType(bytes);
  let filename = output_path || `artifacts/images/seedream-${randomUUID()}${type.ext}`;
  const extension = extname(filename).toLowerCase();
  if (extension !== type.ext && !(type.ext === '.jpg' && extension === '.jpeg')) filename = filename.slice(0, -extension.length) + type.ext;
  const path = await checkedPath(config.root, filename, true);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes, { flag: 'wx' });
  return { path, mimeType: type.mime, bytes: bytes.length, model: config.model, requestedSize: size, prompt: prompt.trim() };
}
