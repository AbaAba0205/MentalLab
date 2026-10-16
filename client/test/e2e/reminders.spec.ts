import { test, expect, type Page } from '@playwright/test';
import { createAccount } from './helpers';

test.beforeEach(async ({ page }) => { await createAccount(page); });

async function openApp(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: '我明白，进入心晴 ↗' }).click();
}

test('the new name appears in metadata, onboarding, brand and companion', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('心晴 · 给情绪一个停靠的地方');
  await expect(page.getByRole('heading', { name: '欢迎来到心晴' })).toBeVisible();
  await page.getByRole('button', { name: '我明白，进入心晴 ↗' }).click();
  await expect(page.locator('.brand')).toHaveAttribute('aria-label', '心晴首页');
  await expect(page.locator('.brand')).toContainText('心晴');
  await expect(page.locator('.brand small')).toHaveText('XINQING');
  await expect(page.locator('.companion-identity')).toContainText('心晴陪伴导师');
  await expect(page.getByRole('log')).toContainText('我是心晴的 AI 心理陪伴导师');
  await expect(page.locator('body')).not.toContainText('心屿');
  const response = await page.request.get('/api/config/reminders');
  expect(response.ok()).toBe(true);
  const config = await response.json();
  await expect(page.locator('.sidebar-note p')).toHaveText(config.messages[0]);
});

test('external content rotates at the configured interval and wraps to the first message', async ({ page }, testInfo) => {
  await page.clock.install({ time: new Date('2026-10-16T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-16T00:00:01Z'));
  await page.route('**/api/config/reminders', route => route.fulfill({ json: {
    intervalSeconds: 5, messages: ['配置的第一条\n慢慢来', '配置的第二条', '配置的第三条'],
  } }));
  await openApp(page);
  const reminder = page.locator('.sidebar-note p');
  await expect(reminder).toHaveText('配置的第一条\n慢慢来');
  await expect(reminder).toHaveCSS('white-space', 'pre-line');
  await page.clock.fastForward(4999);
  await expect(reminder).toHaveText('配置的第一条\n慢慢来');
  await page.clock.fastForward(1);
  await expect(reminder).toHaveText('配置的第二条');
  await page.locator('nav [data-view="courses"]').click();
  await page.clock.fastForward(5000);
  await expect(reminder).toHaveText('配置的第三条');
  await page.clock.fastForward(5000);
  await expect(reminder).toHaveText('配置的第一条\n慢慢来');
  if (testInfo.project.name === 'desktop') await expect(page.getByRole('region', { name: '给自己的小提醒' })).toBeVisible();
  else await expect(page.locator('.sidebar-note')).toBeHidden();
  await page.screenshot({ path: testInfo.outputPath('xinqing-reminder.png'), fullPage: true });
});

test('one message stays visible and a refreshed page reads updated configuration as literal text', async ({ page }) => {
  await page.clock.install();
  let messages = ['唯一的一条提醒'];
  await page.route('**/api/config/reminders', route => route.fulfill({ json: { intervalSeconds: 5, messages } }));
  await openApp(page);
  await expect(page.locator('.sidebar-note p')).toHaveText(messages[0]);
  await page.clock.fastForward(15000);
  await expect(page.locator('.sidebar-note p')).toHaveText(messages[0]);
  messages = ['<img src=x onerror=alert(1)>'];
  await page.reload();
  await expect(page.locator('.sidebar-note p')).toHaveText(messages[0]);
  await expect(page.locator('.sidebar-note img')).toHaveCount(0);
});

for (const fixture of [
  { name: 'empty', response: { json: { intervalSeconds: 30, messages: [] } } },
  { name: 'malformed', response: { contentType: 'application/json', body: '{broken' } },
  { name: 'unavailable', response: { status: 503, body: 'unavailable' } },
]) {
  test(`${fixture.name} configuration hides reminders and leaves the app usable`, async ({ page }) => {
    await page.route('**/api/config/reminders', route => route.fulfill(fixture.response));
    await openApp(page);
    await expect(page.locator('.sidebar-note')).toHaveCount(0);
    await expect(page.locator('.sidebar-label')).toHaveCount(0);
    await expect(page.locator('#chat-input')).toBeEnabled();
    await page.locator('nav [data-view="courses"]').click();
    await expect(page.getByRole('heading', { name: '课程正在慢慢准备中' })).toBeVisible();
  });
}
