import test from 'node:test';
import assert from 'node:assert/strict';
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
