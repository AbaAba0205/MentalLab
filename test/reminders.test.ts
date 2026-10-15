import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseReminderConfig } from '../src/lib/reminders';

test('reminder configuration keeps text and line breaks while ignoring unusable entries', () => {
  assert.deepEqual(parseReminderConfig({ intervalSeconds: 30, messages: ['  第一行\n第二行  ', '', null, 42, 'x'.repeat(121), '另一条提醒'] }), {
    intervalSeconds: 30, messages: ['第一行\n第二行', '另一条提醒'],
  });
});

test('reminder configuration rejects missing text and invalid timer values', () => {
  for (const value of [null, [], {}, { intervalSeconds: 30, messages: [] }, { intervalSeconds: 30, messages: ['   '] },
    { intervalSeconds: 30, messages: '一条提醒' }, ...[0, -1, 4, 3601, 5.5, NaN, Infinity, '30'].map(intervalSeconds => ({ intervalSeconds, messages: ['提醒'] }))]) {
    assert.equal(parseReminderConfig(value), null);
  }
  for (const intervalSeconds of [5, 3600]) {
    assert.deepEqual(parseReminderConfig({ intervalSeconds, messages: ['提醒'] }), { intervalSeconds, messages: ['提醒'] });
  }
});

test('the external reminder file contains valid configurable rotation content', async () => {
  const config = parseReminderConfig(JSON.parse(await readFile(new URL('../public/config/reminders.json', import.meta.url), 'utf8')));
  assert.ok(config);
  assert.equal(config.intervalSeconds, 30);
  assert.ok(config.messages.length > 1);
  assert.equal(new Set(config.messages).size, config.messages.length);
});
