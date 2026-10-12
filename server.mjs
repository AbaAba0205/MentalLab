import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('.', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
const allowed = new Set(['/index.html', '/styles.css', '/app.js', '/model.js']);
http.createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const resource = pathname === '/' ? '/index.html' : pathname;
  if (!allowed.has(resource)) { res.writeHead(404); res.end('Not found'); return; }
  try {
    const data = await readFile(path.join(root, resource));
    res.writeHead(200, { 'Content-Type': types[path.extname(resource)], 'Cache-Control': 'no-store' });
    res.end(data);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(5173, '127.0.0.1', () => console.log('心屿 Demo: http://127.0.0.1:5173'));
