import test from 'node:test';
import assert from 'node:assert/strict';
import { recommendation, needsSupport, newRecord, readRecords, seedRecords, exercises } from '../model.js';

test('recommendation boundaries choose an existing exercise', () => {
  for (const [score, expected] of [[0,'plan'],[3,'plan'],[4,'thought'],[6,'thought'],[7,'ground'],[10,'ground']]) {
    assert.equal(recommendation(score),expected);
    assert.ok(exercises.some(e=>e.id===expected));
  }
});
test('explicit safety signals show support; ordinary exam worry does not', () => {
  assert.equal(needsSupport('考试前我很紧张'),false);
  assert.equal(needsSupport('我不想活了'),true);
  assert.equal(needsSupport('想伤害自己'),true);
});
test('record roundtrip retains a non-improving result without judging it', () => {
  const r=newRecord({kind:'exercise',title:'先稳一稳',before:4,after:6,note:'暂时没有帮助',helpful:'有点不舒服'});
  assert.equal(readRecords(JSON.stringify([r]))[0].after,6);
  assert.equal(r.helpful,'有点不舒服');
  assert.equal(r.demo,false);
});
test('invalid or corrupt local storage is safely recovered', () => {
  for (const raw of ['{broken','null','{}','[null,3,{}]']) assert.deepEqual(readRecords(raw),[]);
  assert.deepEqual(readRecords('[{"id":"a","title":"x","date":"invalid","kind":"checkin"}]'),[]);
});
test('records reject invalid intensity and preserve user text as data', () => {
  assert.throws(()=>newRecord({kind:'exercise',title:'x',before:11}));
  assert.throws(()=>newRecord({kind:'unknown',title:'x'}));
  const r=newRecord({kind:'checkin',title:'签到',before:0,note:'<script>alert(1)</script>'});
  assert.equal(r.before,0);
  assert.equal(r.note,'<script>alert(1)</script>');
});
test('sample records are labeled and distinct; empty records remain empty', () => {
  const records=seedRecords();
  assert.ok(records.every(r=>r.demo));
  assert.equal(new Set(records.map(r=>r.id)).size,records.length);
  assert.deepEqual(readRecords('[]'),[]);
});
