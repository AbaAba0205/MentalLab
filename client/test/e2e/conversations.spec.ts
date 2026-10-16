import { test, expect, type Page } from '@playwright/test';
import { createAccount } from './helpers';

const click = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).click();
async function picker(page: Page) {
  const mobile = page.getByRole('button', { name: '选择会话', exact: true });
  if (await mobile.isVisible()) await mobile.click();
  return page.getByRole('region', { name: '会话列表', exact: true });
}
async function send(page: Page, text: string) {
  await page.locator('#chat-input').fill(text); await click(page, '发送消息 ↗');
  await expect(page.locator('.chat-message.user').last()).toHaveText(`我${text}`);
  await expect(page.getByRole('button', { name: '新建会话', exact: true })).toBeEnabled();
}
test.beforeEach(async ({ page }) => {
  await createAccount(page); await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/chat/turn', route => route.fulfill({ json: { action: 'reply', source: 'ai', reply: '我在听，慢慢说。', exerciseId: null } }));
  await page.goto('/'); await click(page, '我明白，进入心晴 ↗'); await expect(page.locator('#dialog')).toHaveCount(0);
});

test('new conversations isolate model context, switch history and preserve unsent drafts', async ({ page }, testInfo) => {
  await send(page, '第一段：考试前的心情');
  await page.locator('#chat-input').fill('这条草稿暂时不发送');
  await click(page, '新建会话');
  await expect(page.locator('.chat-message.user')).toHaveCount(0); await expect(page.locator('#chat-input')).toHaveValue('');
  let submitted: { messages: { content: string }[] } | undefined;
  await page.route('**/api/chat/turn', async route => { submitted = route.request().postDataJSON(); await route.fulfill({ json: { action: 'reply', source: 'ai', reply: '我们聊聊这件事。', exerciseId: null } }); });
  await send(page, '第二段：和朋友的一件事');
  expect(submitted!.messages.map(item => item.content)).toEqual(['第二段：和朋友的一件事']);
  const list = await picker(page);
  await expect(list.locator('.conversation-row')).toHaveCount(2);
  await expect(list.locator('.conversation-select[aria-current="true"]')).toContainText('第二段');
  await page.screenshot({ path: testInfo.outputPath('conversation-list.png'), fullPage: true });
  await list.getByRole('button', { name: /^第一段：考试前的心情/ }).click();
  await expect(page.locator('.chat-message.user')).toHaveCount(1);
  await expect(page.locator('.chat-message.user')).toContainText('第一段');
  await expect(page.locator('#chat-input')).toHaveValue('这条草稿暂时不发送');
  await page.reload(); await expect(page.locator('.chat-message.user')).toContainText('第一段');
  const again = await picker(page); await expect(again.locator('.conversation-row')).toHaveCount(2);
  await again.getByRole('button', { name: /^第二段：和朋友的一件事/ }).click();
  await expect(page.locator('.chat-message.user')).toContainText('第二段');
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('deleting a conversation needs confirmation and retains sibling messages and practice records', async ({ page }) => {
  await send(page, '保留的会话'); await click(page, '新建会话'); await send(page, '准备删除的会话');
  const record = { id: 'conversation-practice', date: new Date().toISOString(), kind: 'checkin', title: '独立练习记录', note: '不随会话删除', before: 3, after: null, mood: '', helpful: '', demo: false };
  expect((await page.request.post('/api/records', { data: { record } })).ok()).toBe(true);
  let list = await picker(page); await list.getByRole('button', { name: '删除会话：准备删除的会话', exact: true }).click();
  await expect(page.getByRole('heading', { name: '删除这个会话？' })).toBeVisible(); await click(page, '保留会话');
  await expect(page.locator('.chat-message.user')).toContainText('准备删除');
  // On mobile cancelling returns to the picker; desktop remains on the sidebar.
  list = page.getByRole('region', { name: '会话列表', exact: true });
  await list.getByRole('button', { name: '删除会话：准备删除的会话', exact: true }).click(); await click(page, '确认删除会话');
  await expect(page.locator('.chat-message.user')).toContainText('保留的会话');
  const data = await (await page.request.get('/api/chat/conversations')).json();
  expect(data.conversations).toHaveLength(1);
  expect((await (await page.request.get('/api/records')).json()).records).toHaveLength(1);
  await page.reload(); await expect(page.locator('.chat-message.user')).toContainText('保留的会话');
});

test('failed creation retains the current conversation and retry creates one empty session', async ({ page }) => {
  await send(page, '创建失败时也不能丢失');
  await page.route('**/api/chat/conversations', route => route.request().method() === 'POST'
    ? route.fulfill({ status: 503, json: { error: '暂时无法新建会话，请重试' } }) : route.continue());
  await click(page, '新建会话');
  await expect(page.getByRole('alert').filter({ hasText: '暂时无法新建会话' }).first()).toBeVisible();
  await expect(page.locator('.chat-message.user')).toContainText('创建失败时也不能丢失');
  await page.unroute('**/api/chat/conversations'); await click(page, '新建会话');
  await expect(page.locator('.chat-message.user')).toHaveCount(0);
  expect((await (await page.request.get('/api/chat/conversations')).json()).conversations).toHaveLength(2);
});

test('failed history saves block switching until retry saves the original conversation', async ({ page }) => {
  await page.route('**/api/chat/conversations/*', route => route.request().method() === 'PUT'
    ? route.fulfill({ status: 503, json: { error: 'save unavailable' } }) : route.continue());
  await page.locator('#chat-input').fill('等待重试保存'); await click(page, '发送消息 ↗');
  await expect(page.getByRole('button', { name: '重试保存对话', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '新建会话', exact: true })).toBeDisabled();
  await page.unroute('**/api/chat/conversations/*'); await click(page, '重试保存对话');
  await expect(page.getByRole('button', { name: '新建会话', exact: true })).toBeEnabled();
  await click(page, '新建会话');
  const list = await picker(page); await list.getByRole('button', { name: /^等待重试保存/ }).click();
  await expect(page.locator('.chat-message.user')).toContainText('等待重试保存');
});

test('pending replies block switching and stopped replies cannot enter a new conversation', async ({ page }) => {
  let release: () => void = () => {}, finished: () => void = () => {};
  const held = new Promise<void>(resolve => { release = resolve; }), settled = new Promise<void>(resolve => { finished = resolve; });
  await page.route('**/api/chat/turn', async route => {
    await held;
    try { await route.fulfill({ json: { action: 'reply', source: 'ai', reply: '已经过期的旧会话回复', exerciseId: null } }); }
    finally { finished(); }
  });
  await page.locator('#chat-input').fill('暂时终止的旧会话请求'); await click(page, '发送消息 ↗');
  await expect(page.locator('.chat-loading')).toBeVisible();
  await expect(page.getByRole('button', { name: '新建会话', exact: true })).toBeDisabled();
  await click(page, '终止回复 ■');
  await expect(page.getByRole('button', { name: '新建会话', exact: true })).toBeEnabled();
  await click(page, '新建会话'); release(); await settled;
  await expect(page.locator('.chat-message.user')).toHaveCount(0);
  await expect(page.locator('.chat-log')).not.toContainText('已经过期');
  const list = await picker(page); await list.getByRole('button', { name: /^暂时终止的旧会话请求/ }).click();
  await expect(page.locator('.chat-log')).toContainText('本次回复已终止');
});

test('switching back restores the safety state of that conversation', async ({ page }) => {
  await send(page, '我无法保证自己的安全');
  await expect(page.locator('.chat-support')).toBeVisible();
  await click(page, '新建会话');
  await expect(page.locator('.chat-support')).toHaveCount(0); await expect(page.locator('#chat-input')).toBeEnabled();
  await send(page, '今天我想聊聊书');
  const list = await picker(page); await list.getByRole('button', { name: /^我无法保证自己的安全/ }).click();
  await expect(page.locator('.chat-support')).toBeVisible(); await expect(page.locator('#chat-input')).toBeDisabled();
});

test('a slow session change disables sending and preserves the previous draft', async ({ page }) => {
  await send(page, '切换前的消息'); await page.locator('#chat-input').fill('切换前还没有发送的草稿');
  let release: () => void = () => {};
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/chat/conversations', async route => {
    if (route.request().method() === 'POST') await held;
    await route.continue();
  });
  await click(page, '新建会话');
  await expect(page.locator('#chat-input')).toBeDisabled();
  await expect(page.getByRole('button', { name: '发送消息 ↗', exact: true })).toBeDisabled();
  release(); await expect(page.locator('.chat-message.user')).toHaveCount(0);
  await expect(page.locator('#chat-input')).toBeEnabled();
  const list = await picker(page); await list.getByRole('button', { name: /^切换前的消息/ }).click();
  await expect(page.locator('#chat-input')).toHaveValue('切换前还没有发送的草稿');
});
