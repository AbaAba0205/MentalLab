import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { Store, sessionCookie, sessionLifetime, publicUser, verifyPassword, hashPassword, type UserRow } from './database.js';
import { readRecords } from './lib/model.js';
import { parseReminderConfig } from './lib/reminders.js';
import { isChatReply, chatNeedsSupport, parseChatRequest, type ChatMessage } from './lib/chat.js';
import { POST as chatTurn } from './routes/chat.js';
import { POST as scenarioTurn } from './routes/scenario.js';
import { GET as health } from './routes/health.js';
import { aiDiagnosticContext, diagnosticDuration, type AIDiagnosticContext, type AIDiagnosticLogger, type AIDiagnosticReason } from './server/ai-diagnostics.js';

class HTTPError extends Error { constructor(public status: number, message: string) { super(message); } }
const json = (data: unknown, status = 200, headers: HeadersInit = {}) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
function requireValue(condition: unknown, status: number, message: string): asserts condition { if (!condition) throw new HTTPError(status, message); }
function cookie(request: Request) { return request.headers.get('cookie')?.split(';').map(v => v.trim()).find(v => v.startsWith(`${sessionCookie}=`))?.slice(sessionCookie.length + 1); }
function sessionHeader(token: string, secure: boolean, clear = false) { return `${sessionCookie}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${clear ? 0 : sessionLifetime}${secure ? '; Secure' : ''}`; }
async function body(request: Request): Promise<Record<string, unknown>> {
  requireValue(request.headers.get('content-type')?.split(';')[0].trim() === 'application/json', 415, '请使用 JSON 请求');
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  if (request.body) for await (const chunk of request.body as unknown as AsyncIterable<Uint8Array>) {
    bytes += chunk.byteLength;
    requireValue(bytes <= 256_000, 413, '请求内容过长');
    chunks.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    requireValue(value && typeof value === 'object' && !Array.isArray(value), 400, '请求内容不正确');
    return value;
  } catch (error) { if (error instanceof HTTPError) throw error; throw new HTTPError(400, '请求内容不是有效 JSON'); }
}
const validEmail = (value: unknown): value is string => typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const validPassword = (value: unknown): value is string => typeof value === 'string' && value.length >= 10 && value.length <= 128;
const validName = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 40;

function validHistory(value: unknown): value is ChatMessage[] {
  return Array.isArray(value) && value.length <= 200 && value.every(entry => entry && typeof entry === 'object'
    && ['user', 'assistant'].includes(entry.role) && typeof entry.content === 'string' && entry.content.length <= 1000
    && (entry.result === undefined || isChatReply(entry.result))
    && (entry.trainingState === undefined || ['skipped', 'saved'].includes(entry.trainingState)));
}
function validRecord(value: unknown) {
  const parsed = readRecords(JSON.stringify([value]));
  requireValue(parsed.length === 1, 400, '练习记录格式不正确');
  const record = parsed[0];
  requireValue(record.id.length <= 100 && record.title.length <= 120 && record.mood.length <= 50 && record.helpful.length <= 100 && !record.demo, 400, '练习记录不正确');
  return record;
}

export function createApplication(store: Store, options: { origins?: string[]; secure?: boolean; aiLogger?: AIDiagnosticLogger } = {}) {
  const origins = options.origins || (process.env.CLIENT_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000').split(',').map(v => v.trim());
  const secure = options.secure ?? process.env.COOKIE_SECURE === 'true';
  // Equal-cost hash work for unknown accounts, to avoid a fast email-existence oracle.
  const dummyHash = hashPassword(randomUUID());
  async function dispatch(request: Request, peer: string, diagnostics?: AIDiagnosticContext) {
    const url = new URL(request.url), path = url.pathname, method = request.method;
    if (!['GET', 'HEAD'].includes(method)) {
      const origin = request.headers.get('origin');
      const site = request.headers.get('sec-fetch-site');
      requireValue(site !== 'cross-site' && (!origin || origin === url.origin || origins.includes(origin)), 403, '不允许跨站调用');
    }
    if (path === '/api/health' && method === 'GET') { store.db.prepare('SELECT 1').get(); return health(); }
    if ((path === '/' || path === '/admin' || path === '/admin/') && method === 'GET') return new Response(await readFile(new URL('../public/admin.html', import.meta.url)), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
    if (['/admin.js', '/admin.css'].includes(path) && method === 'GET') return new Response(await readFile(new URL(`../public${path}`, import.meta.url)), { headers: { 'Content-Type': path.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/css; charset=utf-8' } });
    if (path === '/api/config/reminders' && method === 'GET') return json(store.reminder());
    if (['/api/auth/register', '/api/auth/login'].includes(path) && method === 'POST') {
      requireValue(store.allow(`auth:${peer}`, Number(process.env.AUTH_IP_LIMIT || 40), 15 * 60_000), 429, '尝试次数过多，请稍后再试');
      const data = await body(request);
      requireValue(validEmail(data.email) && validPassword(data.password), 400, '请填写有效邮箱及 10–128 位密码');
      const email = data.email.trim().toLowerCase();
      requireValue(store.allow(`account:${email}`, 15, 15 * 60_000), 429, '尝试次数过多，请稍后再试');
      let user: UserRow;
      if (path.endsWith('register')) {
        requireValue(validName(data.name), 400, '昵称需要 1–40 个字符');
        requireValue(!store.email(email), 409, '该邮箱已注册');
        try { user = await store.createUser(email, data.name.trim(), data.password); }
        catch (error) { if (store.email(email)) throw new HTTPError(409, '该邮箱已注册'); throw error; }
      } else {
        const existing = store.email(email);
        const valid = await verifyPassword(data.password, existing?.passwordHash || await dummyHash);
        requireValue(valid && existing && !existing.disabled, 401, '邮箱或密码不正确，或账户已停用');
        user = existing;
      }
      return json({ user: publicUser(user) }, path.endsWith('register') ? 201 : 200, { 'Set-Cookie': sessionHeader(store.login(user.id), secure) });
    }
    const token = cookie(request), user = store.authenticate(token);
    requireValue(user, 401, '请先登录');
    if (path === '/api/auth/me' && method === 'GET') return json({ user: publicUser(user) });
    if (path === '/api/auth/logout' && method === 'POST') { store.logout(token!); return json({ ok: true }, 200, { 'Set-Cookie': sessionHeader('', secure, true) }); }
    if (path === '/api/account' && method === 'PATCH') {
      const data = await body(request);
      requireValue(data.onboarded === true, 400, '请确认使用说明');
      store.db.prepare('UPDATE users SET onboarded=1 WHERE id=?').run(user.id);
      return json({ user: publicUser(store.user(user.id)!) });
    }
    if (path === '/api/records') {
      if (method === 'GET') return json({ records: store.records(user.id) });
      if (method === 'POST') {
        const record = validRecord((await body(request)).record);
        // Server identity and clock are authoritative; client IDs make retries idempotent.
        const saved = { ...record, date: new Date().toISOString() };
        store.db.prepare('INSERT OR IGNORE INTO records VALUES (?,?,?)').run(record.id, user.id, JSON.stringify(saved));
        return json({ records: store.records(user.id) }, 201);
      }
      if (method === 'DELETE') { store.db.prepare('DELETE FROM records WHERE userId=?').run(user.id); return json({ records: [] }); }
    }
    if (path === '/api/records/import' && method === 'POST') {
      const data = await body(request);
      requireValue(Array.isArray(data.records) && data.records.length <= 500, 400, '一次最多导入 500 条记录');
      const records = data.records.map(validRecord);
      store.db.exec('BEGIN IMMEDIATE');
      try { for (const record of records) store.db.prepare('INSERT OR IGNORE INTO records VALUES (?,?,?)').run(record.id, user.id, JSON.stringify(record)); store.db.exec('COMMIT'); }
      catch (error) { store.db.exec('ROLLBACK'); throw error; }
      return json({ records: store.records(user.id) });
    }
    if (path.startsWith('/api/records/') && method === 'DELETE') {
      const result = store.db.prepare('DELETE FROM records WHERE userId=? AND id=?').run(user.id, decodeURIComponent(path.slice('/api/records/'.length)));
      requireValue(result.changes, 404, '记录不存在');
      return json({ records: store.records(user.id) });
    }
    if (path === '/api/chat/history') {
      if (method === 'GET') return json({ messages: store.history(user.id, 'chat') });
      if (method === 'PUT') { const data = await body(request); requireValue(validHistory(data.messages), 400, '聊天记录格式不正确或超过 200 条'); store.saveHistory(user.id, 'chat', data.messages); return json({ ok: true }); }
      if (method === 'DELETE') { store.saveHistory(user.id, 'chat', []); return json({ ok: true }); }
    }
    if (path === '/api/chat/conversations') {
      if (method === 'GET') return json({ conversation: store.currentConversation(user.id), conversations: store.conversations(user.id) });
      if (method === 'POST') {
        const conversation = store.createConversation(user.id);
        store.selectConversation(user.id, conversation.id);
        return json({ conversation, conversations: store.conversations(user.id) }, 201);
      }
    }
    const conversationMatch = path.match(/^\/api\/chat\/conversations\/([^/]+)(\/select)?$/);
    if (conversationMatch) {
      const id = decodeURIComponent(conversationMatch[1]), conversation = store.conversation(user.id, id);
      requireValue(conversation, 404, '会话不存在或已被删除');
      if (conversationMatch[2]) {
        if (method === 'POST') return json({ conversation: store.selectConversation(user.id, id), conversations: store.conversations(user.id) });
      } else {
        if (method === 'GET') return json({ conversation });
        if (method === 'PUT') {
          const data = await body(request);
          requireValue(validHistory(data.messages), 400, '聊天记录格式不正确或超过 200 条');
          const saved = store.saveConversation(user.id, id, data.messages)!;
          const { messages: _messages, ...summary } = saved;
          return json({ conversation: summary });
        }
        if (method === 'DELETE') {
          store.db.prepare('DELETE FROM conversations WHERE userId=? AND id=?').run(user.id, id);
          return json({ conversation: store.currentConversation(user.id), conversations: store.conversations(user.id) });
        }
      }
    }
    if (['/api/chat/turn', '/api/scenario/turn'].includes(path) && method === 'POST') {
      const data = await body(request);
      const urgent = path.includes('/chat/') && chatNeedsSupport(parseChatRequest(data) || []);
      requireValue(urgent || store.allow(`ai:${user.id}`, 12), 429, '请求过于频繁，请稍后再试');
      // The outer boundary validates the actual Origin; internal handlers receive a trusted request.
      const inner = new Request(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-forwarded-for': user.id }, body: JSON.stringify(data) });
      const response = await (path.includes('/chat/') ? chatTurn(inner, diagnostics) : scenarioTurn(inner, diagnostics));
      if (response.ok && path.includes('/scenario/')) {
        const reply = await response.clone().json();
        store.saveHistory(user.id, 'scenario', [...data.messages as unknown[], { role: 'assistant', content: reply.reply, result: reply }]);
      }
      return response;
    }
    if (path.startsWith('/api/admin/')) {
      requireValue(user.role === 'admin', 403, '需要管理员权限');
      if (path === '/api/admin/overview' && method === 'GET') {
        return json({ users: store.db.prepare('SELECT id,email,name,role,disabled,onboarded,createdAt FROM users ORDER BY createdAt DESC LIMIT 500').all(),
          records: store.db.prepare('SELECT r.id,r.userId,u.email,r.data FROM records r JOIN users u ON u.id=r.userId ORDER BY json_extract(r.data,\'$.date\') DESC LIMIT 500').all().map(row => ({ ...row, data: JSON.parse(row.data as string) })),
          histories: store.db.prepare("SELECT h.userId,h.channel,h.data,h.updatedAt,u.email,NULL AS conversationId,NULL AS title FROM histories h JOIN users u ON u.id=h.userId UNION ALL SELECT c.userId,'chat',c.data,c.updatedAt,u.email,c.id,c.title FROM conversations c JOIN users u ON u.id=c.userId ORDER BY updatedAt DESC LIMIT 200").all().map(row => ({ ...row, data: JSON.parse(row.data as string) })),
          reminders: store.reminder(), audit: store.db.prepare('SELECT * FROM audit ORDER BY date DESC LIMIT 100').all() });
      }
      if (path === '/api/admin/reminders' && method === 'PUT') {
        const data = await body(request), config = parseReminderConfig(data);
        requireValue(config && Array.isArray(data.messages) && config.messages.length === data.messages.length && config.messages.length <= 50, 400, '提醒配置不正确');
        store.db.prepare('UPDATE settings SET data=? WHERE key=?').run(JSON.stringify(config), 'reminders');
        store.audit(user.id, 'reminders.update', 'reminders');
        return json({ ok: true });
      }
      const userId = path.startsWith('/api/admin/users/') ? decodeURIComponent(path.slice('/api/admin/users/'.length)) : '';
      if (userId && ['PATCH', 'DELETE'].includes(method)) {
        requireValue(userId !== user.id, 400, '不能停用或删除当前管理员');
        const target = store.user(userId);
        requireValue(target && target.role !== 'admin', 400, '此页面仅管理普通用户');
        if (method === 'DELETE') store.db.prepare('DELETE FROM users WHERE id=?').run(userId);
        else { const data = await body(request); requireValue(typeof data.disabled === 'boolean', 400, '账户状态不正确'); store.db.prepare('UPDATE users SET disabled=? WHERE id=?').run(data.disabled ? 1 : 0, userId); store.db.prepare('DELETE FROM sessions WHERE userId=?').run(userId); }
        store.audit(user.id, method === 'DELETE' ? 'user.delete' : 'user.status', userId);
        return json({ ok: true });
      }
      if (path === '/api/admin/record' && method === 'DELETE') {
        requireValue(url.searchParams.has('userId') && url.searchParams.has('id'), 400, '缺少记录标识');
        const owner = url.searchParams.get('userId')!, id = url.searchParams.get('id')!;
        requireValue(store.db.prepare('DELETE FROM records WHERE userId=? AND id=?').run(owner, id).changes, 404, '记录不存在');
        store.audit(user.id, 'record.delete', `${owner}/${id}`); return json({ ok: true });
      }
      if (path === '/api/admin/history' && method === 'DELETE') {
        const owner = url.searchParams.get('userId'), channel = url.searchParams.get('channel');
        requireValue(owner && ['chat', 'scenario'].includes(channel || ''), 400, '缺少聊天标识');
        const conversationId = url.searchParams.get('conversationId');
        if (channel === 'chat' && conversationId) requireValue(store.saveConversation(owner, conversationId, []), 404, '会话不存在');
        else store.saveHistory(owner, channel!, []);
        store.audit(user.id, 'history.clear', `${owner}/${conversationId || channel}`); return json({ ok: true });
      }
    }
    return json({ error: '接口不存在' }, 404);
  }
  return async (request: Request, peer = 'local') => {
    const path = new URL(request.url).pathname;
    const feature = request.method === 'POST' ? path === '/api/chat/turn' ? 'chat' : path === '/api/scenario/turn' ? 'scenario' : undefined : undefined;
    const diagnostics = feature ? aiDiagnosticContext(feature, undefined, options.aiLogger) : undefined;
    const started = performance.now();
    diagnostics?.log({ event: 'ai_http', requestId: diagnostics.requestId, feature: diagnostics.feature, outcome: 'started', durationMs: 0 });
    let response: Response;
    try { response = await dispatch(request, peer, diagnostics); }
    catch (error) {
      if (!(error instanceof HTTPError) && !diagnostics) console.error('Server request failed', error instanceof Error ? error.message : 'unknown');
      response = json({ error: error instanceof HTTPError ? error.message : '服务器暂时无法完成请求' }, error instanceof HTTPError ? error.status : 500);
    }
    if (diagnostics) {
      response.headers.set('X-Request-Id', diagnostics.requestId);
      const status = response.status;
      const reason: AIDiagnosticReason | undefined = response.ok ? undefined : status === 401 ? 'authentication_required'
        : status === 403 ? 'request_forbidden' : status === 429 ? 'rate_limited' : status >= 500 ? 'internal_error' : 'invalid_request';
      diagnostics.log({ event: 'ai_http', requestId: diagnostics.requestId, feature: diagnostics.feature,
        outcome: response.ok ? 'success' : status >= 500 ? 'failure' : 'rejected', reason, responseStatus: status, durationMs: diagnosticDuration(started) });
    }
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('Referrer-Policy', 'no-referrer');
    response.headers.set('Content-Security-Policy', "default-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    return response;
  };
}
