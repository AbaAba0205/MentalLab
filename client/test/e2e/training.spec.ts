import { test, expect } from '@playwright/test';
import { exercises } from '../../src/lib/training/registry';
import { createAccount } from './helpers';

test.beforeEach(async ({ page }) => {
  await createAccount(page);
  await page.goto('/');
  await page.getByRole('button', { name: '我明白，进入心晴 ↗', exact: true }).click();
  await page.locator('nav [data-view="exercises"]').click();
});

test('all four filters expose the complete worksheet catalog without placeholders', async ({ page }) => {
  await expect(page.locator('.exercise-card')).toHaveCount(23);
  for (const [category, count] of [['参与', 6], ['观察', 6], ['智慧心', 6], ['描述', 5]] as const) {
    await page.getByRole('button', { name: category, exact: true }).click();
    await expect(page.locator('.exercise-card')).toHaveCount(count);
    await expect(page.locator('.exercise-card .category')).toHaveText(Array(count).fill(category));
  }
});

for (const exercise of exercises) {
  test(`${exercise.id}: worksheet fields, selections, counters and reflections save and reload`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.locator(`[data-exercise="${exercise.id}"]`).click();
    await expect(page.locator('.skill-guide')).toContainText(exercise.guide!.explanation);
    await page.locator('#intensity').fill('3');
    await page.getByRole('button', { name: '我想试试 ↗', exact: true }).click();
    for (const [index, step] of exercise.steps.entries()) {
      await expect(page.locator('#dialog-title')).toHaveText(step.title);
      for (const [fieldIndex, field] of (step.fields || []).entries()) {
        if (field.choices) {
          const group = page.getByRole('group', { name: field.label, exact: true });
          await group.getByRole('button', { name: field.choices[0], exact: true }).click();
          if (field.multiple) {
            await group.getByRole('button', { name: field.choices[1], exact: true }).click();
            await expect(group.locator('[aria-pressed="true"]')).toHaveCount(2);
          }
        } else {
          await page.locator(fieldIndex ? `#answer-${field.id}` : '#answer').fill(`${field.label}的练习记录`);
        }
      }
      if (step.timer) {
        const seconds = step.durationSeconds || 30;
        await expect(page.locator('#timer-value')).toHaveText(`${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`);
      }
      if (step.counter) {
        await page.getByRole('button', { name: '增加一次' }).click();
        await page.getByRole('button', { name: '增加一次' }).click();
        await expect(page.getByLabel('计数', { exact: true })).toHaveText('2');
      }
      await page.getByRole('button', { name: index === exercise.steps.length - 1 ? '完成，去复盘 →' : '下一步 →', exact: true }).click();
    }
    await page.locator('#intensity').fill('5');
    await page.locator('#reflection').fill('这次感受没有下降，也可以记录。');
    await page.locator('#useful').fill('我发现了一个有用的方法。');
    await page.getByRole('button', { name: '保存这一步 ✓', exact: true }).click();
    await page.getByRole('button', { name: '看看我的记录 ↗', exact: true }).click();
    await expect(page.locator('.full-record')).toContainText(exercise.title);
    await expect(page.locator('.full-record')).toContainText('我发现了一个有用的方法。');
    for (const step of exercise.steps) {
      for (const field of step.fields || []) {
        await expect(page.locator('.full-record')).toContainText(field.choices ? field.choices[0] : `${field.label}的练习记录`);
        if (field.multiple) await expect(page.locator('.full-record')).toContainText(field.choices![1]);
      }
      if (step.counter) await expect(page.locator('.full-record')).toContainText('2 次');
    }
    await page.reload();
    await page.locator('nav [data-view="records"]').click();
    await expect(page.locator('.full-record')).toContainText(exercise.title);
    await expect(page.locator('.record-end')).toContainText('3 → 5');
    expect(errors).toEqual([]);
  });
}

test('multi-select deselection, counter reset and backward navigation retain the current answers', async ({ page }) => {
  await page.locator('[data-exercise="observe-body"]').click();
  await page.getByRole('button', { name: '我想试试 ↗', exact: true }).click();
  await page.getByRole('button', { name: '胸口', exact: true }).click();
  await page.getByRole('button', { name: '肩膀', exact: true }).click();
  await page.getByRole('button', { name: '胸口', exact: true }).click();
  await page.getByRole('button', { name: '下一步 →', exact: true }).click();
  await page.getByRole('button', { name: '上一步', exact: true }).click();
  await expect(page.getByRole('button', { name: '肩膀', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: '胸口', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.locator('[data-exercise="observe-counter"]').click();
  await page.locator('#intensity').fill('3');
  await page.getByRole('button', { name: '我想试试 ↗', exact: true }).click();
  await page.getByRole('button', { name: '增加一次' }).click();
  await page.getByRole('button', { name: '清零计数' }).click();
  await expect(page.getByLabel('计数', { exact: true })).toHaveText('0');
});

test('a worksheet save failure retains every field and both reflections for retry', async ({ page }) => {
  await page.locator('[data-exercise="participate-senses"]').click();
  await page.locator('#intensity').fill('3');
  await page.getByRole('button', { name: '我想试试 ↗', exact: true }).click();
  await page.getByRole('textbox', { name: '看 （选填）', exact: true }).fill('窗外的树');
  await page.getByRole('textbox', { name: '听 （选填）', exact: true }).fill('鸟叫声');
  await page.getByRole('button', { name: '完成，去复盘 →', exact: true }).click();
  await page.locator('#reflection').fill('慢慢投入');
  await page.locator('#useful').fill('一次做一件事');
  await page.route('**/api/records', route => route.fulfill({ status: 503, json: { error: 'unavailable' } }));
  await page.getByRole('button', { name: '保存这一步 ✓', exact: true }).click();
  await expect(page.locator('#dialog [role="alert"]')).toContainText('你填写的内容还在');
  await expect(page.locator('#reflection')).toHaveValue('慢慢投入');
  await expect(page.locator('#useful')).toHaveValue('一次做一件事');
  await page.getByRole('button', { name: '返回练习', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '看 （选填）', exact: true })).toHaveValue('窗外的树');
  await expect(page.getByRole('textbox', { name: '听 （选填）', exact: true })).toHaveValue('鸟叫声');
  await page.getByRole('button', { name: '完成，去复盘 →', exact: true }).click();
  await page.unroute('**/api/records');
  await page.getByRole('button', { name: '保存这一步 ✓', exact: true }).click();
  await page.getByRole('button', { name: '看看我的记录 ↗', exact: true }).click();
  await expect(page.locator('.full-record')).toContainText('窗外的树');
  await expect(page.locator('.full-record')).toContainText('鸟叫声');
  await expect(page.locator('.full-record')).toContainText('一次做一件事');
});

test('30, 60 and 120 second timers pause, finish, restart and reset with their own duration', async ({ page }) => {
  await page.clock.install();
  for (const [id, initial, seconds] of [['wise-quick', '00:30', 30], ['wise-breathing', '01:00', 60], ['observe-counter', '02:00', 120]] as const) {
    await page.locator(`[data-exercise="${id}"]`).click();
    await page.locator('#intensity').fill('3');
    await page.getByRole('button', { name: '我想试试 ↗', exact: true }).click();
    await page.getByRole('button', { name: '开始计时', exact: true }).click();
    await page.clock.fastForward(1000);
    await page.getByRole('button', { name: '暂停计时', exact: true }).click();
    const paused = await page.locator('#timer-value').textContent();
    await page.clock.fastForward(2000);
    await expect(page.locator('#timer-value')).toHaveText(paused!);
    await page.getByRole('button', { name: '继续计时', exact: true }).click();
    await page.clock.fastForward(seconds * 1000);
    await expect(page.locator('#timer-value')).toHaveText('00:00');
    await page.getByRole('button', { name: '再来一次', exact: true }).click();
    await expect(page.locator('#timer-value')).toHaveText(initial);
    await page.getByRole('button', { name: '重置', exact: true }).click();
    await expect(page.locator('#timer-value')).toHaveText(initial);
    await page.getByRole('button', { name: '关闭', exact: true }).click();
  }
});
