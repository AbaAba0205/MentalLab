import { test, expect, type Page } from '@playwright/test';
import { createAccount } from './helpers';

const click = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).click();
async function open(page: Page, id: string) {
  await page.locator(`[data-exercise="${id}"]`).click();
  await click(page, '我想试试 ↗');
}
async function save(page: Page) {
  await click(page, '完成，去复盘 →');
  await click(page, '保存这一步 ✓');
  await click(page, '看看我的记录 ↗');
}
test.beforeEach(async ({ page }) => {
  await createAccount(page);
  await page.goto('/');
  await click(page, '我明白，进入心晴 ↗');
  await page.locator('nav [data-view="exercises"]').click();
});

test('clouds can float, pause and pass; noticed thoughts persist with the journal', async ({ page }) => {
  await open(page, 'observe-clouds');
  await expect(page.locator('.thought-cloud')).toContainText('我完蛋了');
  await click(page, '暂停云朵动画');
  await expect(page.locator('.thought-cloud')).toHaveCSS('animation-play-state', 'paused');
  await click(page, '我注意到了，让它飘过');
  await expect(page.locator('.thought-cloud')).toContainText('他是不是讨厌我');
  await click(page, '我注意到了，让它飘过');
  await expect(page.locator('.thought-cloud')).toContainText('明天的事怎么办');
  await expect(page.locator('.scene-caption')).toContainText('2 朵');
  await click(page, '下一步 →');
  await page.locator('#answer').fill('我看到了想法，也可以回到天空。');
  await save(page);
  await expect(page.locator('.full-record')).toContainText('注意到的想法云：我完蛋了、他是不是讨厌我');
  await page.reload();
  await page.locator('nav [data-view="records"]').click();
  await expect(page.locator('.full-record')).toContainText('我看到了想法，也可以回到天空。');
});

test('keyboard body hotspots and sensation tags stay connected across backward navigation', async ({ page }) => {
  await open(page, 'describe-body');
  const chest = page.getByRole('button', { name: '胸口', exact: true });
  await chest.focus();
  await page.keyboard.press('Enter');
  await expect(chest).toHaveAttribute('aria-pressed', 'true');
  await click(page, '紧绷');
  await click(page, '下一步 →');
  await page.locator('#answer').fill('我的胸口有紧绷的感觉。');
  await click(page, '上一步');
  await expect(chest).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: '紧绷', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await click(page, '下一步 →');
  await save(page);
  await expect(page.locator('.full-record')).toContainText('胸口');
  await expect(page.locator('.full-record')).toContainText('紧绷');
});

test('selected labels create removable parcels on the conveyor', async ({ page }) => {
  await open(page, 'observe-labels');
  await click(page, '这是一个担心');
  await click(page, '这是一个回忆');
  await expect(page.locator('.thought-parcel')).toHaveCount(2);
  await expect(page.locator('.parcel-line')).toContainText('担心');
  await click(page, '这是一个担心');
  await expect(page.locator('.thought-parcel')).toHaveCount(1);
  await expect(page.locator('.thought-parcel')).toHaveText('回忆');
  await save(page);
  await expect(page.locator('.full-record')).toContainText('这是一个回忆');
  await expect(page.locator('.full-record')).not.toContainText('这是一个担心');
});

test('wave positions and immersion gauge respond to their actual selections', async ({ page }) => {
  await open(page, 'observe-urge');
  await click(page, '它在顶点（最强的时候）');
  await expect(page.locator('.urge-wave circle').last()).toHaveAttribute('cx', '280');
  await click(page, '它在退下去（变弱了）');
  await expect(page.locator('.urge-wave circle').last()).toHaveAttribute('cx', '452');
  await click(page, '关闭');
  await open(page, 'participate-rating');
  await click(page, '比较投入');
  await expect(page.locator('.immersion-meter > strong')).toHaveText('比较投入');
  expect((await page.locator('.immersion-meter > svg').boundingBox())!.height).toBeGreaterThan(100);
  await expect(page.locator('.immersion-meter > svg > path').nth(1)).toHaveAttribute('stroke-dasharray', '80 100');
  await save(page);
  await expect(page.locator('.full-record')).toContainText('你的沉浸程度：比较投入');
});

test('letter paper can be folded without losing writing and the rewritten sentence stays literal', async ({ page }) => {
  await open(page, 'wise-friend');
  await page.locator('#answer').fill('要不要跟朋友说这件事');
  await page.locator('#answer-advice').fill('先照顾自己的感受，再慢慢表达。');
  await click(page, '暂时合上信纸');
  await expect(page.locator('.friend-letter')).toBeHidden();
  await click(page, '展开这封信');
  await expect(page.locator('#answer-advice')).toHaveValue('先照顾自己的感受，再慢慢表达。');
  await save(page);
  await expect(page.locator('.full-record')).toContainText('先照顾自己的感受，再慢慢表达。');
  await page.locator('nav [data-view="exercises"]').click();
  await open(page, 'describe-rewrite');
  await page.locator('#answer-thought').fill('<img src=x onerror=alert(1)>');
  await expect(page.locator('.glass-thought > strong')).toHaveText('<img src=x onerror=alert(1)>');
  await expect(page.locator('.glass-thought img')).toHaveCount(0);
});

test('facts and interpretations remain distinct when the comparison view is changed', async ({ page }) => {
  await open(page, 'describe-facts');
  await page.locator('#answer').fill('老师看了我一眼，没有说话。');
  await click(page, '下一步 →');
  await expect(page.locator('.previous-fact')).toContainText('老师看了我一眼，没有说话。');
  await page.locator('#answer').fill('老师可能不喜欢我。');
  await click(page, '下一步 →');
  await expect(page.locator('.fact-comparison')).toContainText('老师可能不喜欢我。');
  await click(page, '只看事实');
  await expect(page.locator('.fact-comparison')).not.toContainText('老师可能不喜欢我。');
  await expect(page.locator('.fact-comparison')).toContainText('老师看了我一眼，没有说话。');
  await click(page, '也看看解读');
  await expect(page.locator('.fact-comparison')).toContainText('老师可能不喜欢我。');
  await save(page);
  await expect(page.locator('.full-record')).toContainText('老师可能不喜欢我。');
});

test('daily completion marks survive revisiting a moment and are saved', async ({ page }) => {
  await open(page, 'participate-daily');
  await click(page, '我完成了这一分钟');
  await click(page, '下一步 →');
  await expect(page.locator('.day-path > div').first().locator('> svg')).toBeVisible();
  await click(page, '上一步');
  await expect(page.getByRole('button', { name: '这一分钟，已经练习过了' })).toHaveAttribute('aria-pressed', 'true');
  await click(page, '下一步 →');
  await click(page, '下一步 →');
  await save(page);
  await expect(page.locator('.full-record')).toContainText('早上的 1 分钟');
  await expect(page.locator('.full-record')).toContainText('日常练习：已完成');
});

test('illustrated guides have expandable methods and scenes fit narrow screens with reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, 'wise-guide');
  await expect(page.locator('.three-minds')).toBeVisible();
  await click(page, '下一步 →');
  await click(page, '下一步 →');
  await page.locator('.method-deck button').first().click();
  await expect(page.locator('.method-deck button').first()).toHaveAttribute('aria-expanded', 'true');
  await click(page, '关闭');
  for (const id of ['observe-body', 'participate-senses', 'wise-decision', 'wise-friend', 'observe-clouds', 'observe-counter']) {
    await open(page, id);
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 844 });
      expect(await page.locator('#dialog').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    }
    if (id === 'observe-clouds') await expect(page.locator('.thought-cloud')).toHaveCSS('animation-name', 'none');
    await click(page, '关闭');
  }
});
