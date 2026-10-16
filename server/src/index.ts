import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { Store } from './database.js';
import { createApplication } from './application.js';

const store = new Store();
const app = createApplication(store);
const server = createServer(async (incoming, outgoing) => {
  try {
    const origin = `http://${incoming.headers.host || 'localhost'}`;
    const headers = new Headers();
    for (const [name, value] of Object.entries(incoming.headers)) { if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join('; ') : value); }
    const init: RequestInit & { duplex?: string } = { method: incoming.method, headers };
    if (!['GET', 'HEAD'].includes(incoming.method || 'GET')) { init.body = Readable.toWeb(incoming) as ReadableStream<Uint8Array>; init.duplex = 'half'; }
    const response = await app(new Request(new URL(incoming.url || '/', origin), init), incoming.socket.remoteAddress || 'local');
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(incoming.method === 'HEAD' ? undefined : Buffer.from(await response.arrayBuffer()));
  } catch { outgoing.writeHead(400); outgoing.end('Bad request'); }
});
server.requestTimeout = 30_000;
server.headersTimeout = 15_000;
server.listen(Number(process.env.PORT || 4000), process.env.HOST || '0.0.0.0', () => console.log(`心晴服务器及管理页面：http://localhost:${process.env.PORT || 4000}/admin`));
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.on(signal, () => server.close(() => { store.close(); process.exit(0); }));
