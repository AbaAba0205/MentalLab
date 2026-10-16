import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { createAccount } from './helpers';

test('register, logout, login and account switching keep records private', async ({ page }, testInfo) => {
  const email = `${randomUUID()}@e2e.test`, password = 'Test-password-2026';
  await page.goto('/');
  await page.getByRole('button', { name: '注册', exact: true }).click();
  await page.getByLabel('昵称', { exact: true }).fill('我的小岛');
  await page.getByLabel('邮箱', { exact: true }).fill(email);
  await page.getByLabel('密码', { exact: true }).fill(password);
  await page.getByLabel('确认密码', { exact: true }).fill(password);
  await page.getByRole('checkbox').check();
  await page.screenshot({ path: testInfo.outputPath('account-register.png'), fullPage: true });
  await page.getByRole('button', { name: '创建账户', exact: true }).click();
  await page.getByRole('button', { name: '我明白，进入心晴 ↗' }).click();
  await expect(page.locator('#dialog')).toHaveCount(0);
  await page.locator('nav [data-view="today"]').click();
  await page.getByRole('button', { name: '开始情绪签到 ↗' }).click();
  await page.locator('#note').fill('属于第一个账户的记录');
  await page.getByRole('button', { name: '记录此刻，看看推荐 ↗' }).click();
  await expect(page.locator('#dialog-title')).toHaveText('谢谢你，愿意照顾自己');
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('button', { name: '退出登录', exact: true }).click();
  await expect(page.getByRole('heading', { name: '欢迎回到你的小岛' })).toBeVisible();
  expect((await page.request.get('/api/records')).status()).toBe(401);
  await page.getByLabel('邮箱', { exact: true }).fill(email);
  await page.getByLabel('密码', { exact: true }).fill(password);
  await page.getByRole('button', { name: '登录我的小岛' }).click();
  await page.locator('nav [data-view="records"]').click();
  await expect(page.locator('.full-record')).toContainText('属于第一个账户的记录');
  await page.getByRole('button', { name: '退出登录', exact: true }).click();
  await expect(page.getByRole('heading', { name: '欢迎回到你的小岛' })).toBeVisible();
  await createAccount(page);
  await page.reload();
  await page.getByRole('button', { name: '我明白，进入心晴 ↗' }).click();
  await page.locator('nav [data-view="records"]').click();
  await expect(page.locator('.full-record')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
});

test('another browser receives account chat and records from the server', async ({ page, browser }) => {
  const account = await createAccount(page);
  await page.goto('/'); await page.getByRole('button', { name: '我明白，进入心晴 ↗' }).click();
  await expect(page.locator('#dialog')).toHaveCount(0);
  await page.locator('#chat-input').fill('我想聊聊今天的考试');
  await page.getByRole('button', { name: '发送消息 ↗' }).click();
  await expect.poll(async () => (await (await page.request.get('/api/chat/history')).json()).messages.length).toBe(2);
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:3100' });
  try {
    expect((await context.request.post('/api/auth/login', { data: account })).status()).toBe(200);
    const other = await context.newPage(); await other.goto('/');
    await expect(other.locator('.chat-message.user')).toContainText('我想聊聊今天的考试');
    await expect(other.getByRole('heading', { name: '欢迎来到心晴' })).toHaveCount(0);
    await expect.poll(async () => (await (await other.request.get('/api/chat/history')).json()).messages.length).toBe(2);
    await other.getByRole('button', { name: '清空对话', exact: true }).click();
    await other.getByRole('button', { name: '确认清空对话', exact: true }).click();
    await expect(other.locator('.chat-message.user')).toHaveCount(0);
    await page.reload(); await expect(page.locator('.chat-message.user')).toHaveCount(0);
  } finally { await context.close(); }
});

test('administrator page manages users, records and reminders with permission checks', async ({ page, browser }, testInfo) => {
  const account = await createAccount(page);
  expect((await page.request.get('/api/admin/overview')).status()).toBe(403);
  const record = { id: randomUUID(), date: new Date().toISOString(), kind: 'checkin', title: '后台管理测试', note: '<img src=x onerror=alert(1)>', before: 3, after: null, mood: '', helpful: '', demo: false };
  expect((await page.request.post('/api/records', { data: { record } })).status()).toBe(201);
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4000' });
  try {
    const admin = await context.newPage(); await admin.goto('/admin');
    await admin.getByLabel('邮箱', { exact: true }).fill('admin@e2e.test');
    await admin.getByLabel('密码', { exact: true }).fill('Admin-password-2026');
    await admin.getByRole('button', { name: '登录管理后台' }).click();
    await expect(admin.locator('#dashboard')).toBeVisible();
    await admin.locator('#search').fill(account.email);
    const row = admin.locator('#user-rows tr').filter({ hasText: account.email });
    await expect(row).toHaveCount(1);
    await expect(admin.locator('#record-list')).toContainText('<img src=x onerror=alert(1)>');
    await expect(admin.locator('#record-list img')).toHaveCount(0);
    await admin.screenshot({ path: testInfo.outputPath('admin-dashboard.png'), fullPage: true });
    admin.on('dialog', dialog => dialog.accept());
    await row.getByRole('button', { name: '停用', exact: true }).click();
    await expect(row).toContainText('已停用');
    expect((await page.request.get('/api/records')).status()).toBe(401);
    await row.getByRole('button', { name: '启用', exact: true }).click();
    await expect(row).toContainText('正常');
    await admin.locator('#record-list').getByRole('button', { name: '删除记录', exact: true }).click();
    await expect(admin.locator('#record-list article')).toHaveCount(0);
    // Only inspect the shared reminder configuration here; unit tests exercise updates.
    expect(Number(await admin.locator('[name="interval"]').inputValue())).toBeGreaterThanOrEqual(5);
    await row.getByRole('button', { name: '删除用户', exact: true }).click();
    await expect(row).toHaveCount(0);
  } finally { await context.close(); }
});
