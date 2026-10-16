import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseReminderConfig } from '../src/lib/reminders.js';

test('database bootstrap reminder content is valid and configurable', async () => {
  const config = parseReminderConfig(JSON.parse(await readFile(new URL('../config/reminders.json', import.meta.url), 'utf8')));
  assert.ok(config); assert.equal(config.intervalSeconds, 30); assert.ok(config.messages.length > 1);
  assert.equal(new Set(config.messages).size, config.messages.length);
});
