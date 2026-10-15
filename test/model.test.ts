import test from 'node:test';
import assert from 'node:assert/strict';
import { recommendation, needsSupport, newRecord, readRecords, seedRecords, exercises, recordId } from '../src/lib/model';
import { steps } from '../src/lib/exercises';
import { GET } from '../src/app/api/health/route';

test('recommendation boundaries choose an existing exercise', () => {
  for (const [score, expected] of [[0, 'plan'], [3, 'plan'], [4, 'ground'], [6, 'ground'], [7, 'ground'], [10, 'ground']] as const) {
    assert.equal(recommendation(score), expected);
    assert.ok(exercises.some(e => e.id === expected));
  }
  for (const value of [-1, 11, NaN, Infinity]) assert.throws(() => recommendation(value));
});

test('demonstration support guard recognizes explicit signals', () => {
  assert.equal(needsSupport('考试前我很紧张'), false);
  for (const text of ['我不想活了', '想伤害自己', '我正在被打']) assert.equal(needsSupport(text), true);
});

test('record roundtrip retains a non-improving result without judging it', () => {
  const r = newRecord({ kind: 'exercise', title: '先稳一稳', before: 4, after: 6, note: '暂时没有帮助', helpful: '有点不舒服' });
  assert.deepEqual(readRecords(JSON.stringify([r])), [r]);
  assert.equal(r.demo, false);
});

test('invalid or corrupt local storage is safely recovered', () => {
  for (const raw of [null, '{broken', 'null', '{}', '[null,3,{}]']) assert.deepEqual(readRecords(raw), []);
  assert.deepEqual(readRecords('[{"id":"a","title":"x","date":"invalid","kind":"checkin"}]'), []);
});

test('untrusted persisted fields cannot crash React or corrupt intensity displays', () => {
  const valid = newRecord({ kind: 'checkin', title: '情绪签到' });
  for (const fields of [{ note: {} }, { helpful: [] }, { mood: 42 }, { before: 11 }, { after: '4' }, { kind: 'other' }, { title: '' }]) {
    assert.deepEqual(readRecords(JSON.stringify([{ ...valid, ...fields }, valid])), [valid]);
  }
});

test('legacy demo records without optional fields migrate without dropping valid content', () => {
  const legacy = { id: 'demo-1', date: '2026-10-12T00:00:00.000Z', kind: 'checkin', title: '情绪签到', mood: '有点焦虑', before: 5, note: '想到周五的考试', demo: true };
  const [record] = readRecords(JSON.stringify([legacy]));
  assert.equal(record.after, null);
  assert.equal(record.helpful, '');
  assert.equal(record.note, legacy.note);
  assert.equal(record.demo, true);
});

test('records reject invalid inputs, preserve zero and keep user text as data', () => {
  assert.throws(() => newRecord({ kind: 'exercise', title: 'x', before: 11 }));
  // @ts-expect-error Runtime validation must also reject malformed callers.
  assert.throws(() => newRecord({ kind: 'unknown', title: 'x' }));
  assert.throws(() => newRecord({ kind: 'checkin', title: '' }));
  const r = newRecord({ kind: 'checkin', title: '签到', before: 0, note: '<script>alert(1)</script>' });
  assert.equal(r.before, 0);
  assert.equal(r.note, '<script>alert(1)</script>');
});

test('a full three-step reflection fits the record without silent loss', () => {
  const note = ['a'.repeat(500), 'b'.repeat(500), 'c'.repeat(500), 'd'.repeat(500)].join('\n');
  assert.equal(newRecord({ kind: 'exercise', title: '练习', note }).note, note);
  assert.equal(newRecord({ kind: 'exercise', title: '练习', note: 'x'.repeat(4100) }).note.length, 4000);
});

test('record IDs remain available for phone previews over non-secure LAN HTTP', () => {
  const source = { getRandomValues: crypto.getRandomValues.bind(crypto) };
  const ids = Array.from({ length: 20 }, () => recordId(source));
  assert.equal(new Set(ids).size, 20);
  for (const id of ids) assert.match(id, /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/);
});

test('sample records are labeled, distinct and deterministic; empty records stay empty', () => {
  const records = seedRecords(new Date('2026-10-12T00:00:00Z'));
  assert.ok(records.every(r => r.demo));
  assert.equal(new Set(records.map(r => r.id)).size, records.length);
  assert.equal(records[0].date, '2026-10-11T00:00:00.000Z');
  assert.deepEqual(readRecords('[]'), []);
});

test('registered exercises expose usable steps without a fixed step count', () => {
  for (const exercise of exercises) {
    assert.ok(steps[exercise.id].length > 0);
    for (const step of steps[exercise.id]) assert.ok(step.title && step.intro && (step.prompt || step.placeholder || step.choices?.length));
  }
});

test('health endpoint reports actual integration status without caching', async () => {
  const response = GET();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await response.json(), { status: 'ok', service: 'xinqing', ai: 'not-configured', model: 'DeepSeek-V4.1-Flash', storage: 'browser-local' });
});
