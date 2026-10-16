import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store, sessionCookie, hashPassword, verifyPassword } from '../src/database.js';
import { createApplication } from '../src/application.js';
import { newRecord } from '../src/lib/model.js';

const password = 'Valid-password-2026';
function setup(path = ':memory:') {
  const store = new Store(path), app = createApplication(store, { origins: ['http://client.test'], secure: true });
  const call = async (path: string, method = 'GET', data?: unknown, token = '', headers: Record<string, string> = {}) => app(new Request(`http://server.test${path}`, { method, headers: { 'content-type': 'application/json', cookie: token, ...headers }, body: data === undefined ? undefined : JSON.stringify(data) }));
  const register = async (email: string) => { const response = await call('/api/auth/register', 'POST', { email, name: '测试用户', password, role: 'admin' }); assert.equal(response.status, 201); return { user: (await response.json()).user, token: response.headers.get('set-cookie')!.split(';')[0] }; };
  return { store, app, call, register };
}

test('passwords use independent salts and verify without plaintext storage', async () => {
  const a = await hashPassword(password), b = await hashPassword(password);
  assert.notEqual(a, b); assert.equal(a.includes(password), false);
  assert.equal(await verifyPassword(password, a), true); assert.equal(await verifyPassword('wrong', a), false);
});

test('registration, login, cookie security, logout, duplicate and forged roles', async t => {
  const { store, call, register } = setup(); t.after(() => store.close());
  assert.equal((await call('/api/records')).status, 401);
  const alice = await register('Alice@example.com');
  assert.equal(alice.user.role, 'user'); assert.equal(alice.user.email, 'alice@example.com');
  assert.equal('passwordHash' in alice.user, false);
  assert.equal((await call('/api/auth/register', 'POST', { email: 'alice@example.com', name: 'x', password })).status, 409);
  assert.equal((await call('/api/auth/register', 'POST', { email: 'wrong', name: 'x', password: 'short' })).status, 400);
  assert.equal((await call('/api/auth/login', 'POST', { email: 'alice@example.com', password: 'wrong-long-password' })).status, 401);
  const login = await call('/api/auth/login', 'POST', { email: 'ALICE@example.com', password });
  assert.equal(login.status, 200);
  const header = login.headers.get('set-cookie')!;
  for (const flag of ['HttpOnly', 'SameSite=Lax', 'Secure', 'Path=/', 'Max-Age=604800']) assert.ok(header.includes(flag));
  assert.equal((await call('/api/auth/me', 'GET', undefined, header.split(';')[0])).status, 200);
  assert.equal((await call('/api/auth/logout', 'POST', undefined, alice.token)).status, 200);
  assert.equal((await call('/api/auth/me', 'GET', undefined, alice.token)).status, 401);
});

test('account limits block repeated authentication and expired sessions cannot access data', async t => {
  const { store, call, register } = setup(); t.after(() => store.close());
  const alice = await register('rate@example.com');
  for (let i = 0; i < 14; i++) await call('/api/auth/login', 'POST', { email: 'rate@example.com', password: 'invalid-password' });
  assert.equal((await call('/api/auth/login', 'POST', { email: 'rate@example.com', password })).status, 429);
  store.db.prepare('UPDATE sessions SET expiresAt=0').run();
  assert.equal((await call('/api/records', 'GET', undefined, alice.token)).status, 401);
});

test('origin allowlist rejects spoofed proxy headers, malformed and oversized requests', async t => {
  const { store, app, call, register } = setup(); t.after(() => store.close());
  const alice = await register('origin@example.com');
  assert.equal((await call('/api/account', 'PATCH', { onboarded: true }, alice.token, { origin: 'http://evil.test', 'sec-fetch-site': 'same-origin', 'x-forwarded-host': 'evil.test' })).status, 403);
  assert.equal((await call('/api/account', 'PATCH', { onboarded: true }, alice.token, { origin: 'http://client.test' })).status, 200);
  assert.equal((await app(new Request('http://server.test/api/chat/history', { method: 'PUT', headers: { cookie: alice.token, 'content-type': 'application/json' }, body: '{broken' }))).status, 400);
  assert.equal((await call('/api/chat/history', 'PUT', { messages: ['x'.repeat(260_000)] }, alice.token)).status, 413);
  assert.equal((await call('/api/records', 'POST', { record: {} }, alice.token)).status, 400);
});

test('records are durable, idempotent and isolated; import, individual deletion and clearing', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'xinqing-test-')), path = join(directory, 'test.sqlite');
  const { store, call, register } = setup(path); let closed = false; let reopened: ReturnType<typeof setup> | undefined;
  t.after(() => { if (!closed) store.close(); reopened?.store.close(); rmSync(directory, { recursive: true, force: true }); });
  const alice = await register('alice@example.com'), bob = await register('bob@example.com');
  const record = newRecord({ kind: 'checkin', title: '情绪签到', note: '<img src=x onerror=alert(1)>', before: 5 });
  assert.equal((await call('/api/records', 'POST', { record, userId: bob.user.id }, alice.token)).status, 201);
  await call('/api/records', 'POST', { record }, alice.token);
  assert.equal((await (await call('/api/records', 'GET', undefined, alice.token)).json()).records.length, 1);
  assert.deepEqual((await (await call('/api/records', 'GET', undefined, bob.token)).json()).records, []);
  assert.equal((await call(`/api/records/${record.id}`, 'DELETE', undefined, bob.token)).status, 404);
  const legacy = { ...record, id: 'legacy', date: '2026-10-12T00:00:00Z' };
  for (let i = 0; i < 2; i++) assert.equal((await call('/api/records/import', 'POST', { records: [legacy] }, alice.token)).status, 200);
  assert.equal(store.records(alice.user.id).length, 2);
  store.close(); closed = true;
  reopened = setup(path);
  assert.equal((await (await reopened.call('/api/records', 'GET', undefined, alice.token)).json()).records.length, 2);
  assert.equal((await reopened.call(`/api/records/${record.id}`, 'DELETE', undefined, alice.token)).status, 200);
  await reopened.call('/api/records', 'DELETE', undefined, alice.token);
  assert.deepEqual(reopened.store.records(alice.user.id), []);
});

test('onboarding and chat survive login on another device; clearing is scoped to the owner', async t => {
  const { store, call, register } = setup(); t.after(() => store.close());
  const alice = await register('alice@example.com'), bob = await register('bob@example.com');
  const messages = [{ role: 'user', content: '今天有些紧张' }, { role: 'assistant', content: '愿意说说吗？' }];
  await call('/api/chat/history', 'PUT', { messages }, alice.token);
  await call('/api/account', 'PATCH', { onboarded: true }, alice.token);
  const otherDevice = await call('/api/auth/login', 'POST', { email: 'alice@example.com', password });
  const token = otherDevice.headers.get('set-cookie')!.split(';')[0];
  assert.deepEqual((await (await call('/api/chat/history', 'GET', undefined, token)).json()).messages, messages);
  assert.equal((await (await call('/api/auth/me', 'GET', undefined, token)).json()).user.onboarded, true);
  await call('/api/chat/history', 'DELETE', undefined, bob.token);
  assert.equal(store.history(alice.user.id, 'chat').length, 2);
  await call('/api/chat/history', 'DELETE', undefined, token);
  assert.deepEqual(store.history(alice.user.id, 'chat'), []);
});

test('admin role gates management; state changes revoke sessions and deletion cascades with audit', async t => {
  const { store, call, register } = setup(); t.after(() => store.close());
  const alice = await register('alice@example.com');
  assert.equal((await call('/api/admin/overview', 'GET', undefined, alice.token)).status, 403);
  const admin = await store.createUser('admin@example.com', '管理员', password, 'admin');
  const token = `${sessionCookie}=${store.login(admin.id)}`;
  const overview = await (await call('/api/admin/overview', 'GET', undefined, token)).json();
  assert.equal(overview.users.length, 2); assert.equal(JSON.stringify(overview).includes('passwordHash'), false);
  assert.equal((await call(`/api/admin/users/${admin.id}`, 'DELETE', undefined, token)).status, 400);
  assert.equal((await call('/api/admin/reminders', 'PUT', { intervalSeconds: 5, messages: ['新的提醒'] }, token)).status, 200);
  assert.deepEqual(await (await call('/api/config/reminders')).json(), { intervalSeconds: 5, messages: ['新的提醒'] });
  assert.equal((await call('/api/admin/reminders', 'PUT', { intervalSeconds: 2, messages: [] }, token)).status, 400);
  await call(`/api/admin/users/${alice.user.id}`, 'PATCH', { disabled: true }, token);
  assert.equal((await call('/api/records', 'GET', undefined, alice.token)).status, 401);
  assert.equal((await call('/api/auth/login', 'POST', { email: 'alice@example.com', password })).status, 401);
  await call(`/api/admin/users/${alice.user.id}`, 'PATCH', { disabled: false }, token);
  store.saveHistory(alice.user.id, 'chat', [{ role: 'user', content: '你好' }]);
  await call(`/api/admin/users/${alice.user.id}`, 'DELETE', undefined, token);
  assert.equal(store.user(alice.user.id), undefined); assert.deepEqual(store.history(alice.user.id, 'chat'), []);
  assert.ok(Number(store.db.prepare('SELECT count(*) AS n FROM audit').get()!.n) >= 4);
});

test('public health and administrator page have security headers and no secrets', async t => {
  const { store, call } = setup(); t.after(() => store.close());
  const health = await call('/api/health'); assert.equal(health.status, 200); assert.equal((await health.json()).storage, 'server-sqlite');
  const page = await call('/admin'); assert.equal(page.status, 200); assert.ok((await page.text()).includes('管理员登录'));
  assert.equal(page.headers.get('x-frame-options'), 'DENY'); assert.ok(page.headers.get('content-security-policy')?.includes("frame-ancestors 'none'"));
});
