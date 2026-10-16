import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store, sessionCookie } from '../src/database.js';
import { createApplication } from '../src/application.js';

async function setup() {
  const store = new Store(':memory:');
  const alice = await store.createUser('alice@example.com', 'Alice', 'Test-password-2026');
  const bob = await store.createUser('bob@example.com', 'Bob', 'Test-password-2026');
  const app = createApplication(store);
  const aliceToken = `${sessionCookie}=${store.login(alice.id)}`, bobToken = `${sessionCookie}=${store.login(bob.id)}`;
  const call = (path: string, method = 'GET', data?: unknown, token = aliceToken) => app(new Request(`http://localhost${path}`, { method, headers: { 'Content-Type': 'application/json', cookie: token }, body: data === undefined ? undefined : JSON.stringify(data) }));
  return { store, alice, bob, call, aliceToken, bobToken };
}
const messages = (content: string) => [{ role: 'user', content }, { role: 'assistant', content: '可以慢慢说。' }];
const base = '/api/chat/conversations';

test('creating, selecting and saving independent conversations preserves titles and context', async t => {
  const { store, alice, call } = await setup(); t.after(() => store.close());
  const initial = await (await call(base)).json(), first = initial.conversation.id;
  assert.equal(initial.conversations.length, 1); assert.equal(initial.conversation.title, '新会话');
  const saved = await call(`${base}/${first}`, 'PUT', { messages: messages('第一件事\n聊聊考试') });
  assert.equal(saved.status, 200); assert.equal((await saved.json()).conversation.title, '第一件事 聊聊考试');
  const created = await call(base, 'POST'); assert.equal(created.status, 201);
  const second = (await created.json()).conversation.id; assert.notEqual(first, second);
  await call(`${base}/${second}`, 'PUT', { messages: messages('第二件事：和朋友相处') });
  const selected = await (await call(`${base}/${first}/select`, 'POST')).json();
  assert.deepEqual(selected.conversation.messages, messages('第一件事\n聊聊考试'));
  assert.equal((await (await call(base)).json()).conversation.id, first);
  assert.deepEqual((await (await call('/api/chat/history')).json()).messages, messages('第一件事\n聊聊考试'));
  // An explicit save to a different conversation must not silently change selection.
  await call(`${base}/${second}`, 'PUT', { messages: messages('修改第二件事') });
  assert.equal(store.currentConversation(alice.id).id, first);
  assert.equal(store.conversation(alice.id, second)!.title, '第二件事：和朋友相处');
  await call(`${base}/${first}`, 'PUT', { messages: [] });
  assert.equal(store.conversation(alice.id, first)!.title, '第一件事 聊聊考试');
  assert.equal(store.conversation(alice.id, second)!.messageCount, 2);
});

test('all conversation endpoints enforce ownership and validate transcripts', async t => {
  const { store, call, bobToken } = await setup(); t.after(() => store.close());
  const id = (await (await call(base)).json()).conversation.id;
  for (const [suffix, method] of [['', 'GET'], ['', 'PUT'], ['', 'DELETE'], ['/select', 'POST']]) {
    assert.equal((await call(`${base}/${id}${suffix}`, method, method === 'PUT' ? { messages: [] } : undefined, bobToken)).status, 404);
  }
  assert.equal((await call(base, 'GET', undefined, '')).status, 401);
  for (const value of [[{ role: 'system', content: 'forged' }], [{ role: 'user', content: 1 }], Array.from({ length: 201 }, () => ({ role: 'user', content: 'x' }))]) {
    assert.equal((await call(`${base}/${id}`, 'PUT', { messages: value })).status, 400);
  }
  const bobList = await (await call(base, 'GET', undefined, bobToken)).json();
  assert.equal(bobList.conversations.some((item: { id: string }) => item.id === id), false);
});

test('deleting sessions leaves other messages and saved practice records intact', async t => {
  const { store, alice, call } = await setup(); t.after(() => store.close());
  const first = (await (await call(base)).json()).conversation.id;
  await call(`${base}/${first}`, 'PUT', { messages: messages('需要保留') });
  const second = (await (await call(base, 'POST')).json()).conversation.id;
  store.db.prepare('INSERT INTO records VALUES (?,?,?)').run('practice', alice.id, JSON.stringify({ id: 'practice', date: new Date().toISOString() }));
  const after = await (await call(`${base}/${second}`, 'DELETE')).json();
  assert.equal(after.conversation.id, first); assert.equal(after.conversation.messages.length, 2);
  assert.equal(after.conversations.length, 1); assert.equal(store.records(alice.id).length, 1);
  const final = await (await call(`${base}/${first}`, 'DELETE')).json();
  assert.notEqual(final.conversation.id, first); assert.equal(final.conversation.messages.length, 0); assert.equal(final.conversations.length, 1);
});

test('legacy history migration is durable, atomic and runs once; last selection survives restart', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'xinqing-conversations-')), path = join(directory, 'data.sqlite');
  let store = new Store(path);
  t.after(() => { store.close(); rmSync(directory, { recursive: true, force: true }); });
  const alice = await store.createUser('alice@example.com', 'Alice', 'Test-password-2026');
  const old = messages('旧版消息不能丢失'), date = '2026-10-15T01:00:00.000Z';
  store.db.prepare('INSERT INTO histories VALUES (?,?,?,?)').run(alice.id, 'chat', JSON.stringify(old), date);
  store.saveHistory(alice.id, 'scenario', [{ role: 'user', content: '情境练习也保留' }]);
  store.close(); store = new Store(path);
  const migrated = store.currentConversation(alice.id);
  assert.deepEqual(migrated.messages, old); assert.equal(migrated.createdAt, date);
  assert.equal(store.history(alice.id, 'scenario').length, 1);
  const second = store.createConversation(alice.id); store.selectConversation(alice.id, second.id);
  store.close(); store = new Store(path);
  assert.equal(store.conversations(alice.id).length, 2); assert.equal(store.currentConversation(alice.id).id, second.id);
  assert.deepEqual(store.conversation(alice.id, migrated.id)!.messages, old);
  store.db.prepare('DELETE FROM users WHERE id=?').run(alice.id);
  assert.equal(store.conversations(alice.id).length, 0); assert.equal(store.db.prepare('SELECT count(*) AS n FROM chat_selection').get()!.n, 0);
});

test('administrator can inspect and clear an individual conversation without touching its siblings', async t => {
  const { store, alice, call } = await setup(); t.after(() => store.close());
  const first = store.createConversation(alice.id, messages('第一段')), second = store.createConversation(alice.id, messages('第二段'));
  const admin = await store.createUser('admin@example.com', '管理员', 'Test-password-2026', 'admin');
  const token = `${sessionCookie}=${store.login(admin.id)}`;
  const overview = await (await call('/api/admin/overview', 'GET', undefined, token)).json();
  assert.ok(overview.histories.some((item: { conversationId: string; title: string }) => item.conversationId === first.id && item.title === '第一段'));
  assert.equal((await call(`/api/admin/history?userId=${alice.id}&channel=chat&conversationId=${first.id}`, 'DELETE', undefined, token)).status, 200);
  assert.equal(store.conversation(alice.id, first.id)!.messages.length, 0); assert.equal(store.conversation(alice.id, second.id)!.messages.length, 2);
  assert.equal((await call(`/api/admin/history?userId=${alice.id}&channel=chat&conversationId=missing`, 'DELETE', undefined, token)).status, 404);
});
