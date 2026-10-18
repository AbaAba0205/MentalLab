import { test, expect, type Page } from '@playwright/test';
import { createAccount } from './helpers';

const click = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).click();
const navigate = (page: Page, view: string) => page.locator('nav [data-view="' + view + '"]').click();
async function send(page: Page, text: string) {
  await page.locator('#chat-input').fill(text);
  await click(page, '发送消息 ↗');
  await expect(page.locator('.chat-loading')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '终止回复 ■', exact: true })).toHaveCount(0);
}
test.beforeEach(async ({ page }, testInfo) => {
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': 'e2e-' + testInfo.testId });
  await createAccount(page);
  await page.goto('/');
  await click(page, '我明白，进入心晴 ↗');
  await expect(page.locator('#dialog')).toHaveCount(0);
});

test('companion is the default home and courses have an honest reserved entry', async ({ page }, testInfo) => {
  await expect(page.getByRole('heading', { name: '随心聊，慢慢说' })).toBeVisible();
  await expect(page.locator('nav [data-view="chat"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('log')).toContainText('AI 心理陪伴导师');
  await expect(page.locator('.companion-identity')).toContainText('DeepSeek-V4.1-Flash');
  await expect(page.locator('.companion')).toHaveCSS('border-top-width', '0px');
  await expect(page.locator('.chat-log')).toHaveCSS('overflow-y', testInfo.project.name === 'mobile' ? 'visible' : 'scroll');
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
  await expect(page.locator('.exercise-card')).toHaveCount(23);
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

test('desktop transcript scrolls without growing the page and halves horizontal margins', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Desktop transcript layout');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/chat/turn', route => route.fulfill({ json: {
    action: 'reply', source: 'ai', reply: '可以慢慢说，我会认真读。\n'.repeat(40), exerciseId: null,
  } }));
  for (const viewport of [{ width: 1440, height: 1050 }, { width: 1024, height: 768 }, { width: 768, height: 720 }]) {
    await page.setViewportSize(viewport);
    const before = await page.evaluate(() => document.documentElement.scrollHeight);
    await send(page, '我想聊聊今天');
    const metrics = await page.locator('.chat-log').evaluate(element => {
      const main = element.closest('main')!.getBoundingClientRect();
      const box = element.getBoundingClientRect();
      const gutter = parseFloat(getComputedStyle(element.closest('.app-shell')!).getPropertyValue('--chat-page-gutter'));
      const oldWidth = Math.min(820, main.width - gutter * 2);
      return { pageHeight: document.documentElement.scrollHeight, height: element.clientHeight, total: element.scrollHeight,
        left: box.left - main.left, right: main.right - box.right, expectedMargin: (main.width - oldWidth) / 4,
        atBottom: element.scrollHeight - element.scrollTop - element.clientHeight };
    });
    expect(metrics.pageHeight).toBe(before);
    expect(metrics.pageHeight).toBeLessThanOrEqual(viewport.height);
    expect(metrics.total).toBeGreaterThan(metrics.height);
    expect(metrics.height).toBeGreaterThan(80);
    expect(metrics.left).toBeCloseTo(metrics.expectedMargin, 0);
    expect(metrics.right).toBeCloseTo(metrics.expectedMargin, 0);
    expect(metrics.atBottom).toBeLessThanOrEqual(2);
    await expect(page.getByRole('button', { name: '发送消息 ↗' })).toBeInViewport();
    await page.getByRole('log').hover();
    await page.mouse.wheel(0, -400);
    await expect.poll(() => page.getByRole('log').evaluate(element => element.scrollHeight - element.scrollTop - element.clientHeight)).toBeGreaterThan(100);
  }
  await page.screenshot({ path: testInfo.outputPath('desktop-scroll.png'), fullPage: true });
});

test('waiting keeps the next draft editable, stop cancels the old reply and allows sending again', async ({ page }) => {
  let release: () => void = () => {};
  const held = new Promise<void>(resolve => { release = resolve; });
  let requests = 0;
  const contexts: { role: string; content: string }[][] = [];
  await page.route('**/api/chat/turn', async route => {
    contexts.push(route.request().postDataJSON().messages);
    const requestNumber = ++requests;
    if (requestNumber === 1) await held;
    await route.fulfill({ json: { action: 'reply', source: 'ai', reply: requestNumber === 1 ? '已终止的旧回应' : '新的回应', exerciseId: null } });
  });
  await page.locator('#chat-input').fill('第一条消息');
  await click(page, '发送消息 ↗');
  await expect(page.getByRole('button', { name: '终止回复 ■' })).toBeEnabled();
  await expect(page.locator('#chat-input')).toBeEnabled();
  await page.locator('#chat-input').fill('下一条草稿');
  await expect(page.locator('.pending')).toContainText('第一条消息');
  await expect(page.locator('.pending')).not.toContainText('下一条草稿');
  await page.locator('#chat-input').press('Control+Enter');
  expect(requests).toBe(1);
  await click(page, '终止回复 ■');
  await expect(page.locator('#chat-input')).toBeFocused();
  await expect(page.locator('#chat-input')).toHaveValue('下一条草稿');
  await expect(page.getByRole('button', { name: '发送消息 ↗' })).toBeEnabled();
  release();
  await click(page, '发送消息 ↗');
  await expect(page.locator('.chat-reply').last()).toHaveText('新的回应');
  expect(contexts[1]).toEqual([{ role: 'user', content: '第一条消息' }, { role: 'assistant', content: '（本次回复已终止）' }, { role: 'user', content: '下一条草稿' }]);
  await expect(page.getByRole('log')).not.toContainText('已终止的旧回应');
  await expect(page.locator('.chat-composer [role="alert"]')).toHaveCount(0);
});

test('a completed request preserves a draft typed while waiting', async ({ page }) => {
  let release: () => void = () => {};
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/chat/turn', async route => {
    await held;
    await route.fulfill({ json: { action: 'reply', source: 'ai', reply: '我在听。', exerciseId: null } });
  });
  await page.locator('#chat-input').fill('已发送的内容');
  await click(page, '发送消息 ↗');
  await page.locator('#chat-input').fill('正在准备的下一条');
  release();
  await expect(page.locator('.chat-reply')).toHaveText('我在听。');
  await expect(page.locator('#chat-input')).toHaveValue('正在准备的下一条');
  await expect(page.locator('.chat-message.user')).toHaveText('我已发送的内容');
});

test('stop freezes progressive output and only the visible text enters the next context', async ({ page }) => {
  const reply = '可以慢慢说，我会认真读你写下的每一句话。'.repeat(8);
  let context: { role: string; content: string }[] = [];
  await page.route('**/api/chat/turn', route => {
    context = route.request().postDataJSON().messages;
    return route.fulfill({ json: { action: 'reply', source: 'ai', reply, exerciseId: null } });
  });
  await page.locator('#chat-input').fill('想聊聊');
  await click(page, '发送消息 ↗');
  const output = page.locator('.chat-reply').last();
  await expect(output).toHaveAttribute('data-typing', 'true');
  await expect.poll(() => output.textContent()).not.toBe('');
  await page.locator('#chat-input').fill('接着说');
  await click(page, '终止回复 ■');
  const partial = await output.textContent();
  expect(partial!.length).toBeLessThan(reply.length);
  await expect(output).not.toHaveAttribute('data-typing', 'true');
  await page.waitForTimeout(150);
  await expect(output).toHaveText(partial!);
  await expect(page.locator('#chat-input')).toHaveValue('接着说');
  await click(page, '发送消息 ↗');
  await expect.poll(() => context.at(-1)?.content).toBe('接着说');
  expect(context.find(message => message.role === 'assistant')?.content).toBe(partial);
});

test('a failed request keeps a newer draft and the original pending message', async ({ page }) => {
  let release: () => void = () => {};
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/chat/turn', async route => {
    await held;
    await route.fulfill({ status: 503, json: { error: 'unavailable' } });
  });
  await page.locator('#chat-input').fill('第一条消息');
  await click(page, '发送消息 ↗');
  await page.locator('#chat-input').fill('保留这条新草稿');
  release();
  await expect(page.locator('.chat-composer [role="alert"]')).toContainText('内容还在');
  await expect(page.locator('#chat-input')).toHaveValue('保留这条新草稿');
  await expect(page.locator('.pending')).toContainText('第一条消息');
  await expect(page.getByRole('button', { name: '终止回复 ■' })).toHaveCount(0);
});

test('preset chat is labeled, persists on the server and survives refresh', async ({ page }) => {
  const responsePromise = page.waitForResponse(response => response.url().endsWith('/api/chat/turn') && response.request().method() === 'POST');
  await send(page, '今天有点累，想聊聊');
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  expect(response.headers()['x-request-id']).toMatch(/^[a-f0-9-]{36}$/);
  await expect(page.locator('.chat-source')).toHaveText('预设回应 · AI 暂时不可用');
  await navigate(page, 'today');
  await navigate(page, 'chat');
  await expect(page.locator('.chat-message.user')).toContainText('今天有点累');
  const stored = await page.evaluate(() => JSON.stringify(localStorage));
  expect(stored).not.toContain('今天有点累');
  await page.reload();
  await expect(page.locator('.chat-message.user')).toHaveCount(1);
});

test('inline training completes in chat and saves only its reflection', async ({ page }, testInfo) => {
  await send(page, '我想试一个小练习');
  await expect(page.locator('.chat-training-card')).toContainText('身体感觉观察');
  await click(page, '开始小训练');
  await expect(page.locator('#dialog')).toHaveCount(0);
  await click(page, '我想试试 ↗');
  await click(page, '下一步 →');
  await click(page, '开始计时');
  await expect(page.locator('.timer-ring strong')).toHaveText('00:59');
  await click(page, '暂停计时');
  await page.screenshot({ path: testInfo.outputPath('inline-training.png'), fullPage: true });
  await click(page, '下一步 →');
  await click(page, '完成，去复盘 →');
  await click(page, '暂时没感觉');
  await page.locator('#chat-reflection').fill('听见窗外的鸟声');
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

test('an old placeholder recommendation preserves its chat and does not prevent future saves', async ({ page }) => {
  await page.route('**/api/chat/conversations', async route => {
    const response = await route.fetch();
    const snapshot = await response.json();
    snapshot.conversation.messages = [
      { role: 'user', content: '这是旧版留下的聊天' },
      { role: 'assistant', content: '原来的聊天内容还在', result: { action: 'reply', source: 'fallback', reply: '原来的聊天内容还在', exerciseId: 'ground' } },
    ];
    await route.fulfill({ response, json: snapshot });
  });
  await page.reload();
  await expect(page.getByRole('log')).toContainText('原来的聊天内容还在');
  await expect(page.locator('.chat-training-card')).toHaveCount(0);
  await page.unroute('**/api/chat/conversations');
  await send(page, '我想继续聊聊');
  await expect.poll(async () => {
    const snapshot = await (await page.request.get('/api/chat/conversations')).json();
    return snapshot.conversation.messages.length;
  }).toBe(4);
  await page.reload();
  await expect(page.getByRole('log')).toContainText('原来的聊天内容还在');
  await expect(page.getByRole('log')).toContainText('我想继续聊聊');
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
  await page.locator('#chat-reflection').fill('大家没有我会更好');
  await click(page, '保存这一步 ✓');
  await expect(page.locator('.chat-support')).toBeVisible();
  await navigate(page, 'records');
  await expect(page.locator('.full-record')).toHaveCount(0);
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
  await page.locator('[data-exercise="describe-facts"]').click();
  await page.locator('#intensity').fill('8');
  await expect(page.getByRole('button', { name: '我想试试 ↗' })).toHaveCount(0);
  await click(page, '先试试稳定练习');
  await expect(page.locator('#dialog-title')).toHaveText('身体感觉观察');
  await click(page, '我想试试 ↗');
  await expect(page.locator('#dialog-title')).toHaveText('注意此刻的身体');
});


test('a late model reply cannot resume chat after training requests real support', async ({ page }) => {
  await send(page, '我想试一个小练习');
  await click(page, '开始小训练');
  let finished: () => void = () => {};
  const settled = new Promise<void>(resolve => { finished = resolve; });
  await page.route('**/api/chat/turn', async route => {
    await new Promise(resolve => setTimeout(resolve, 500));
    try { await route.fulfill({ json: { action: 'reply', source: 'ai', reply: '这是一条已经过期的普通回应', exerciseId: 'observe-body' } }); }
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
