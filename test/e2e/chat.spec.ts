import { test, expect, type Page } from '@playwright/test';

const click = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).click();
const navigate = (page: Page, view: string) => page.locator('nav [data-view="' + view + '"]').click();
async function send(page: Page, text: string) {
  await page.locator('#chat-input').fill(text);
  await click(page, '发送消息 ↗');
  await expect(page.locator('.chat-loading')).toHaveCount(0);
}
test.beforeEach(async ({ page }, testInfo) => {
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': 'e2e-' + testInfo.testId });
  await page.goto('/');
  await click(page, '我明白，进入心屿 ↗');
});

test('companion is the default home and courses have an honest reserved entry', async ({ page }, testInfo) => {
  await expect(page.getByRole('heading', { name: '随心聊，慢慢说' })).toBeVisible();
  await expect(page.locator('nav [data-view="chat"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('log')).toContainText('AI 心理陪伴导师');
  await expect(page.locator('.companion-identity')).toContainText('DeepSeek-V4.1-Flash');
  await expect(page.locator('.companion')).toHaveCSS('border-top-width', '0px');
  await expect(page.locator('.chat-log')).toHaveCSS('overflow-y', 'visible');
  const sendBox = await page.getByRole('button', { name: '发送消息 ↗' }).boundingBox();
  const navigationBox = await page.locator('.sidebar').boundingBox();
  expect(sendBox).not.toBeNull();
  expect(navigationBox).not.toBeNull();
  if (testInfo.project.name === 'mobile') expect(sendBox!.y + sendBox!.height).toBeLessThanOrEqual(navigationBox!.y);
  await page.screenshot({ path: testInfo.outputPath('companion-home.png'), fullPage: true });
  await navigate(page, 'courses');
  await expect(page.getByRole('heading', { name: '课程正在慢慢准备中' })).toBeVisible();
  await expect(page.locator('.course-card')).toHaveCount(3);
  await expect(page.locator('.course-card').first()).toContainText('筹备中');
  await page.screenshot({ path: testInfo.outputPath('courses.png'), fullPage: true });
  await click(page, '去练习室 ↗');
  await expect(page.locator('.exercise-card')).toHaveCount(3);
  await page.reload();
  await expect(page.getByRole('heading', { name: '随心聊，慢慢说' })).toBeVisible();
});

test('validated AI reply appears progressively and completes', async ({ page }) => {
  const reply = '可以慢慢说，我会认真读你写下的每一句话，也不会催你马上整理好情绪。';
  await page.route('**/api/chat/turn', route => route.fulfill({ json: { action: 'reply', source: 'ai', reply, exerciseId: null } }));
  await page.locator('#chat-input').fill('我想聊聊今天');
  await click(page, '发送消息 ↗');
  const message = page.locator('.chat-message.assistant').last();
  await expect(message.locator('.chat-reply')).toHaveAttribute('data-typing', 'true');
  await expect(message.locator('.chat-reply')).toContainText(reply, { timeout: 5000 });
  await expect(message.locator('.chat-reply')).not.toHaveAttribute('data-typing', 'true');
});

test('preset chat is labeled, retains context across navigation, and disappears on refresh', async ({ page }) => {
  await send(page, '今天有点累，想聊聊');
  await expect(page.locator('.chat-source')).toHaveText('预设回应 · AI 暂时不可用');
  await navigate(page, 'today');
  await navigate(page, 'chat');
  await expect(page.locator('.chat-message.user')).toContainText('今天有点累');
  const stored = await page.evaluate(() => JSON.stringify(localStorage));
  expect(stored).not.toContain('今天有点累');
  await page.reload();
  await expect(page.locator('.chat-message.user')).toHaveCount(0);
});

test('inline training completes in chat and saves only its reflection', async ({ page }, testInfo) => {
  await send(page, '我想试一个小练习');
  await expect(page.locator('.chat-training-card')).toContainText('先稳一稳');
  await click(page, '开始小训练');
  await expect(page.locator('#dialog')).toHaveCount(0);
  await click(page, '我想试试 ↗');
  await click(page, '下一步 →');
  await click(page, '开始计时');
  await expect(page.locator('.timer-ring strong')).toHaveText('00:29');
  await click(page, '暂停计时');
  await page.screenshot({ path: testInfo.outputPath('inline-training.png'), fullPage: true });
  await click(page, '下一步 →');
  await click(page, '完成，去复盘 →');
  await click(page, '暂时没感觉');
  await page.locator('.inline-training textarea').fill('听见窗外的鸟声');
  await click(page, '保存这一步 ✓');
  await expect(page.locator('.training-status')).toContainText('已完成');
  await navigate(page, 'records');
  await expect(page.locator('.full-record').first()).toContainText('听见窗外的鸟声');
  await expect(page.locator('.full-record').first()).toContainText('暂时没感觉');
  await expect(page.locator('.full-record').first()).not.toContainText('我想试一个小练习');
  await navigate(page, 'chat');
  await send(page, '我想试一个小练习');
  await expect(page.getByRole('button', { name: '开始小训练' })).toBeEnabled();
});

test('skipping a recommendation prevents repeated unsolicited cards', async ({ page }) => {
  await send(page, '我想试一个小练习');
  await click(page, '暂时不练，继续聊');
  await send(page, '明天考试让我很紧张');
  await expect(page.locator('.chat-message.assistant').last()).toContainText('不安排练习');
  await expect(page.getByRole('button', { name: '开始小训练' })).toHaveCount(0);
});

test('risk during chat removes existing training cards and pauses ordinary messages', async ({ page }) => {
  await send(page, '我想试一个小练习');
  await click(page, '开始小训练');
  await send(page, '我现在想伤害自己');
  await expect(page.locator('.chat-support')).toBeVisible();
  await expect(page.locator('#chat-input')).toBeDisabled();
  await expect(page.locator('.chat-training-card')).toHaveCount(0);
  await click(page, '查看现实支持');
  await expect(page.locator('#dialog-title')).toHaveText('你可以寻求身边的帮助');
  await click(page, '关闭帮助页');
  await expect(page.locator('#chat-input')).toBeDisabled();
});

test('model safety response and risk inside a training both stop the session', async ({ page }) => {
  await page.route('**/api/chat/turn', route => route.fulfill({ json: { action: 'handoff', source: 'safety', reply: '我们先照顾现实安全。你现在是否安全？', exerciseId: null } }));
  await send(page, '有些事情很难说');
  await expect(page.locator('.chat-support')).toBeVisible();
  await click(page, '清空对话');
  await click(page, '确认清空对话');
  await page.unroute('**/api/chat/turn');
  await send(page, '我想试一个小练习');
  await click(page, '开始小训练');
  await click(page, '我想试试 ↗');
  await click(page, '下一步 →');
  await click(page, '下一步 →');
  await click(page, '完成，去复盘 →');
  await page.locator('.inline-training textarea').fill('大家没有我会更好');
  await click(page, '保存这一步 ✓');
  await expect(page.locator('.chat-support')).toBeVisible();
  await navigate(page, 'records');
  await expect(page.locator('.full-record')).toHaveCount(2);
});

test('failed requests retain the draft and retry without duplicate user messages', async ({ page }) => {
  let attempts = 0;
  await page.route('**/api/chat/turn', route => {
    attempts++;
    return route.fulfill(attempts === 1 ? { status: 503, json: { error: 'unavailable' } } : { json: { action: 'reply', source: 'ai', reply: '可以慢慢说，我会认真读。', exerciseId: null } });
  });
  await send(page, '我想聊聊今天');
  await expect(page.locator('.chat-composer [role="alert"]')).toContainText('内容还在');
  await expect(page.locator('#chat-input')).toHaveValue('我想聊聊今天');
  await click(page, '重试发送');
  await expect(page.locator('.chat-source')).toHaveText('AI 回应');
  await expect(page.locator('.chat-message.user')).toHaveCount(1);
  await expect(page.locator('#chat-input')).toHaveValue('');
});

test('clear requires confirmation, user markup stays literal and mobile controls fit', async ({ page }, testInfo) => {
  await send(page, '<img src=x onerror=alert(1)>');
  await expect(page.locator('.chat-message.user')).toContainText('<img src=x onerror=alert(1)>');
  await expect(page.locator('.chat-message img')).toHaveCount(0);
  await click(page, '清空对话');
  await click(page, '保留对话');
  await expect(page.locator('.chat-message.user')).toHaveCount(1);
  await click(page, '清空对话');
  await click(page, '确认清空对话');
  await expect(page.locator('.chat-message.user')).toHaveCount(0);
  for (const width of [320, 390, 768, 1024]) {
    await page.setViewportSize({ width, height: testInfo.project.use.viewport!.height });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const target of await page.locator('nav .nav-item').all()) {
      const box = await target.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    await navigate(page, 'courses');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await navigate(page, 'chat');
  }
});

test('training library redirects high intensity to stabilization before analysis', async ({ page }) => {
  await navigate(page, 'exercises');
  await page.locator('[data-exercise="thought"]').click();
  await page.locator('#intensity').fill('8');
  await expect(page.getByRole('button', { name: '我想试试 ↗' })).toHaveCount(0);
  await click(page, '先试试稳定练习');
  await expect(page.locator('#dialog-title')).toHaveText('先稳一稳');
  await click(page, '我想试试 ↗');
  await expect(page.locator('#dialog-title')).toHaveText('找一个舒服的位置');
});


test('a late model reply cannot resume chat after training requests real support', async ({ page }) => {
  await send(page, '我想试一个小练习');
  await click(page, '开始小训练');
  let finished: () => void = () => {};
  const settled = new Promise<void>(resolve => { finished = resolve; });
  await page.route('**/api/chat/turn', async route => {
    await new Promise(resolve => setTimeout(resolve, 500));
    try { await route.fulfill({ json: { action: 'reply', source: 'ai', reply: '这是一条已经过期的普通回应', exerciseId: 'ground' } }); }
    finally { finished(); }
  });
  await page.locator('#chat-input').fill('我想再说一点');
  await click(page, '发送消息 ↗');
  await click(page, '我需要帮助');
  await expect(page.locator('.chat-support')).toBeVisible();
  await settled;
  await expect(page.locator('.chat-log')).not.toContainText('已经过期');
  await expect(page.locator('.chat-training-card')).toHaveCount(0);
  await expect(page.locator('#chat-input')).toBeDisabled();
});
