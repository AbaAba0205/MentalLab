import { test, expect } from '@playwright/test';
import { exercises } from '../../src/lib/training/registry';
import { createAccount } from './helpers';
import { stepPresentation } from '../../src/lib/training/presentation';

test.beforeEach(async ({ page }) => {
  await createAccount(page);
  await page.goto('/');
  await page.getByRole('button', { name: '我明白，进入心晴 ↗', exact: true }).click();
  await page.locator('nav [data-view="exercises"]').click();
});

test('all four filters expose the complete worksheet catalog without placeholders', async ({ page }) => {
  await expect(page.locator('.exercise-card')).toHaveCount(27);
  for (const [category, count] of [['参与', 7], ['观察', 7], ['智慧心', 7], ['描述', 6]] as const) {
    await page.getByRole('button', { name: category, exact: true }).click();
    await expect(page.locator('.exercise-card')).toHaveCount(count);
    await expect(page.locator('.exercise-card .category')).toHaveText(Array(count).fill(category));
    await expect(page.locator('.exercise-card').first()).toContainText(`${category} · 技能讲解`);
  }
});

for (const exercise of exercises) {
  test(`${exercise.id}: selected content opens at high and default intensity, saves and reloads`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.locator(`[data-exercise="${exercise.id}"]`).click();
    await page.locator('#intensity').fill('10');
    await page.getByRole('button', { name: '我想试试 ↗', exact: true }).click();
    await expect(page.locator('#dialog-title')).toHaveText(exercise.steps[0].title);
    await expect(page.locator('.modal-label')).toContainText(exercise.title);
    await page.getByRole('button', { name: '关闭', exact: true }).click();
    await page.locator(`[data-exercise="${exercise.id}"]`).click();
    await expect(page.locator('#intensity')).toHaveValue('5');
    await expect(page.locator('#dialog')).not.toContainText(exercise.guide!.explanation);
    await page.getByRole('button', { name: '我想试试 ↗', exact: true }).click();
    for (const [index, step] of exercise.steps.entries()) {
      await expect(page.locator('#dialog-title')).toHaveText(step.title);
      await expect(page.locator('#dialog .intro')).toHaveText(step.intro);
      await expect(page.locator('[data-presentation]')).toHaveAttribute('data-presentation', stepPresentation(exercise.id, step, index));
      if (step.examples) await expect(page.locator('.practice-examples .example-copy')).toHaveText(step.examples);
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
      if (index === 0) {
        expect(await page.locator('#dialog').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
        await page.locator('#dialog').screenshot({ path: testInfo.outputPath('experience.png'), animations: 'disabled' });
      }
      await page.getByRole('button', { name: index === exercise.steps.length - 1 ? '完成，去复盘 →' : '下一步 →', exact: true }).click();
    }
    await page.locator('#intensity').fill('7');
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
    await expect(page.locator('.record-end')).toContainText('5 → 7');
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
