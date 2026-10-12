import { test, expect, type Page } from '@playwright/test';

const click = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).click();
const recordsView = (page: Page) => page.locator('nav [data-view="records"]').click();

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '嗨，今天的你还好吗？' })).toBeVisible();
  // Check again after each test, including hydration and timer cleanup errors.
  Object.assign(page, { appErrors: errors });
});

test.afterEach(async ({ page }) => {
  expect((page as Page & { appErrors: string[] }).appErrors).toEqual([]);
});

test('check-in, grounding timer, reflection, reload and confirmed deletion', async ({ page }) => {
  await click(page, '开始情绪签到 ↗');
  await page.locator('#dialog [data-mood="anxious"]').click();
  await page.locator('#intensity').fill('8');
  await page.locator('#note').fill('明天有数学考试，我有些紧张。');
  await click(page, '记录此刻，看看推荐 ↗');
  await expect(page.locator('.summary')).toContainText('先稳一稳');
  await click(page, '试试这个练习 ↗');
  await click(page, '我想试试 ↗');
  await click(page, '下一步 →');
  await click(page, '开始计时');
  await expect(page.locator('#timer-value')).toHaveText('00:29');
  await click(page, '暂停计时');
  const paused = await page.locator('#timer-value').textContent();
  await page.waitForTimeout(1100);
  await expect(page.locator('#timer-value')).toHaveText(paused!);
  await click(page, '重置');
  await expect(page.locator('#timer-value')).toHaveText('00:30');
  await click(page, '下一步 →');
  await click(page, '完成，去复盘 →');
  await page.locator('#intensity').fill('6');
  await click(page, '有一点帮助');
  await page.locator('#reflection').fill('看看窗外，感觉好一点。');
  await click(page, '保存这一步 ✓');
  await click(page, '看看我的记录 ↗');
  await expect(page.locator('.full-record')).toHaveCount(4);
  await page.reload();
  await recordsView(page);
  await expect(page.locator('.full-record')).toHaveCount(4);
  await page.locator('.delete-button').first().click();
  await click(page, '保留');
  await expect(page.locator('.full-record')).toHaveCount(4);
  await page.locator('.delete-button').first().click();
  await click(page, '确认删除');
  await expect(page.locator('.full-record')).toHaveCount(3);
});

for (const id of ['thought', 'plan']) {
  test(`${id} preserves previous answers, validates choices and saves feedback`, async ({ page }) => {
    await page.locator('nav [data-view="exercises"]').click();
    await page.locator(`[data-exercise="${id}"]`).click();
    await click(page, '我想试试 ↗');
    if (id === 'plan') {
      await click(page, '下一步 →');
      await expect(page.locator('#dialog-title')).toContainText('选一个');
      await click(page, '整理明天的考试用品');
    } else await page.locator('#answer').fill('我担心一次考试决定全部。');
    await click(page, '下一步 →');
    await page.locator('#answer').fill('我也有做得不错的时候。');
    await click(page, '上一步');
    if (id === 'thought') await expect(page.locator('#answer')).toHaveValue('我担心一次考试决定全部。');
    else await expect(page.locator('[data-choice].selected')).toHaveCount(1);
    await click(page, '下一步 →');
    await expect(page.locator('#answer')).toHaveValue('我也有做得不错的时候。');
    await click(page, '下一步 →');
    await page.locator('#answer').fill('我可以先做一点准备。');
    await click(page, '完成，去复盘 →');
    await click(page, '暂时没感觉');
    await click(page, '保存这一步 ✓');
    await click(page, '回到空间');
    await click(page, '想法整理');
    await expect(page.locator('.exercise-card')).toHaveCount(1);
    await recordsView(page);
    await expect(page.locator('.full-record').first()).toContainText('暂时没感觉');
    await expect(page.locator('.full-record').first()).toContainText('我也有做得不错的时候。');
  });
}

test('support interrupts check-in, exercise answers and reflection without saving', async ({ page }) => {
  await click(page, '开始情绪签到 ↗');
  await page.locator('#note').fill('我不想活了');
  await click(page, '记录此刻，看看推荐 ↗');
  await expect(page.locator('#dialog-title')).toHaveText('你可以寻求身边的帮助');
  await expect(page.locator('#dialog a[href="tel:120"]')).toHaveCount(1);
  await click(page, '关闭帮助页');
  await page.locator('[data-exercise="thought"]').click();
  await click(page, '我想试试 ↗');
  await page.locator('#answer').fill('想伤害自己');
  await click(page, '下一步 →');
  await expect(page.locator('#dialog-title')).toHaveText('你可以寻求身边的帮助');
  await click(page, '关闭帮助页');
  await page.locator('[data-exercise="ground"]').click();
  await click(page, '我想试试 ↗');
  await click(page, '下一步 →');
  await click(page, '下一步 →');
  await click(page, '完成，去复盘 →');
  await page.locator('#reflection').fill('我不想活了');
  await click(page, '保存这一步 ✓');
  await expect(page.locator('#dialog-title')).toHaveText('你可以寻求身边的帮助');
  await click(page, '关闭帮助页');
  await recordsView(page);
  await expect(page.locator('.full-record')).toHaveCount(2);
});

test('user markup stays literal and clearing records persists across reload', async ({ page }) => {
  await click(page, '开始情绪签到 ↗');
  await page.locator('#note').fill('<img src=x onerror=alert(1)>');
  await click(page, '记录此刻，看看推荐 ↗');
  await click(page, '关闭');
  await recordsView(page);
  await expect(page.locator('.full-record').first()).toContainText('<img src=x onerror=alert(1)>');
  await expect(page.locator('.full-record img')).toHaveCount(0);
  await click(page, '本地数据说明');
  await expect(page.locator('.privacy-copy')).toContainText('尚未接入真实 AI');
  await click(page, '清空所有本地记录');
  await click(page, '确认清空');
  await page.reload();
  await recordsView(page);
  await expect(page.locator('.full-record')).toHaveCount(0);
  await expect(page.locator('.empty')).toContainText('这里还没有记录');
});

test('malformed storage recovers; legacy records survive client hydration', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('mind-island-demo-v1', '{broken'));
  await page.reload();
  await recordsView(page);
  await expect(page.locator('.full-record')).toHaveCount(0);
  await page.evaluate(() => localStorage.setItem('mind-island-demo-v1', JSON.stringify([
    { id: 'legacy', title: '迁移前的记录', date: '2026-10-12T00:00:00Z', kind: 'checkin', note: '仍然保留' },
    { id: 'malformed', title: '坏记录', date: '2026-10-12T00:00:00Z', kind: 'checkin', note: {} },
  ])));
  await page.reload();
  await recordsView(page);
  await expect(page.locator('.full-record')).toHaveCount(1);
  await expect(page.locator('.full-record')).toContainText('仍然保留');
});

test('responsive layout, modal keyboard dismissal and timer cleanup', async ({ page }, testInfo) => {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('home.png'), fullPage: true });
  await page.locator('[data-exercise="ground"]').click();
  await click(page, '我想试试 ↗');
  await click(page, '下一步 →');
  await click(page, '开始计时');
  await page.keyboard.press('Escape');
  await expect(page.locator('#dialog')).toHaveCount(0);
  await page.waitForTimeout(1100);
  await page.locator('[data-exercise="ground"]').click();
  await click(page, '我想试试 ↗');
  await click(page, '下一步 →');
  await expect(page.locator('#timer-value')).toHaveText('00:30');
  await expect(page.getByRole('button', { name: '开始计时', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('practice.png'), fullPage: true });
  expect(await page.locator('#dialog').evaluate(el => el.getBoundingClientRect().width < window.innerWidth)).toBe(true);
});

test('storage failure remains usable and tells the user changes are temporary', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new DOMException('blocked', 'SecurityError'); };
    Storage.prototype.setItem = () => { throw new DOMException('blocked', 'SecurityError'); };
  });
  await page.reload();
  await click(page, '开始情绪签到 ↗');
  await click(page, '记录此刻，看看推荐 ↗');
  await expect(page.locator('#toast')).toContainText('变更仅在当前页面有效');
  await click(page, '关闭');
  await recordsView(page);
  await expect(page.locator('.full-record')).toHaveCount(3);
});

test('server health and response headers match the development preview', async ({ request }) => {
  const response = await request.get('/api/health');
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: 'ok', service: 'mental-lab', ai: 'not-configured', storage: 'browser-local' });
  expect(response.headers()['cache-control']).toBe('no-store');
  expect(response.headers()['x-content-type-options']).toBe('nosniff');
});
