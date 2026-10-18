import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { exercises, exerciseCategories, getExercise, isExerciseId } from '../src/lib/training/registry';
import { serializePractice, type StepAnswer } from '../src/lib/training/dbt';
import { newRecord, readRecords } from '../src/lib/model';
import { restoreChatTraining, type ChatReply } from '../src/lib/chat';

const expected = {
  '参与': ['选一件你要做的事', '1 分钟沉浸体验', '五感投入检查', '走神计数器', '沉浸程度打分', '参与 · 今天的小练习'],
  '观察': ['想法云朵练习', '身体感觉观察', '给想法贴标签', '冲动冲浪', '“注意到”计数器', '观察 · 今天的小练习'],
  '智慧心': ['你现在需要做一个什么决定？', '三种脑分类', '呼吸 + 身体安静下来', '智慧朋友来信', '智慧心说了什么？', '30 秒智慧心速查'],
  '描述': ['区分事实和解读', '用描述句式改写', '身体感受扫描', '换个情境再试一次', '描述 · 今天的小练习'],
};

test('all 23 worksheet practices replace the placeholders in four ordered categories', () => {
  assert.deepEqual(exerciseCategories, Object.keys(expected));
  assert.equal(exercises.length, 23);
  assert.equal(new Set(exercises.map(item => item.id)).size, 23);
  for (const [category, titles] of Object.entries(expected)) {
    assert.deepEqual(exercises.filter(item => item.category === category).map(item => item.title), titles);
  }
  for (const id of ['ground', 'thought', 'plan', '__proto__']) assert.equal(isExerciseId(id), false);
  for (const exercise of exercises) {
    assert.equal(getExercise(exercise.id), exercise);
    assert.ok(exercise.guide?.explanation);
    assert.equal(exercise.guide?.levels.length, 5);
    assert.equal(exercise.guide?.reflections.length, 2);
    for (const step of exercise.steps) {
      const ids = (step.fields || []).map(field => field.id);
      assert.equal(new Set(ids).size, ids.length);
    }
  }
});

test('worksheet durations, breathing, counters and daily practices retain their instructions', () => {
  const durations = { 'participate-immersion': 60, 'participate-counter': 120, 'observe-counter': 120, 'wise-breathing': 60, 'wise-quick': 30 } as const;
  for (const [id, seconds] of Object.entries(durations)) {
    assert.equal(exercises.find(item => item.id === id)?.steps.find(step => step.timer)?.durationSeconds, seconds);
  }
  for (const id of ['participate-counter', 'observe-counter']) assert.ok(exercises.find(item => item.id === id)?.steps[0].counter);
  assert.equal(getExercise('wise-breathing').steps[0].breathing, true);
  for (const item of exercises.filter(item => item.id.endsWith('-daily'))) {
    assert.equal(item.steps.length, 3);
    assert.deepEqual(item.steps.map(step => step.durationSeconds), [60, 60, 60]);
  }
});

test('labeled answers, multiple selections and counts survive storage without losing full forms', () => {
  for (const exercise of exercises) {
    const answers: StepAnswer[] = exercise.steps.map(step => Object.fromEntries([
      ...(step.fields || []).map(field => [field.id, field.choices ? (field.multiple ? field.choices : field.choices[0]) : '答'.repeat(300)]),
      ...(step.counter ? [['count', 12]] : []),
    ]));
    const practice = serializePractice(exercise.steps, answers);
    const note = [practice, ...exercise.guide!.reflections.map(label => `${label}：${'感'.repeat(300)}`)].join('\n\n');
    assert.ok(note.length <= 4000, `${exercise.id} exceeds record capacity`);
    const record = newRecord({ kind: 'exercise', title: exercise.title, before: 3, after: 5, note });
    assert.equal(record.note, note);
    assert.deepEqual(readRecords(JSON.stringify([record])), [record]);
    for (const [index, step] of exercise.steps.entries()) {
      for (const field of step.fields || []) assert.ok(practice.includes(`${field.label}：`));
      if (step.counter) assert.ok(practice.includes(`${step.counter}：12 次`));
      assert.ok(answers[index]);
    }
  }
  assert.equal(serializePractice(getExercise('observe-body').steps, []), '');
});

test('independently deployed client and server use identical exercise content and field schemas', () => {
  for (const file of ['dbt.ts', 'types.ts']) {
    const client = readFileSync(new URL(`../src/lib/training/${file}`, import.meta.url), 'utf8');
    const server = readFileSync(new URL(`../../server/src/lib/training/${file}`, import.meta.url), 'utf8');
    assert.equal(client.replace("from './types'", "from './types.js'"), server);
  }
});

test('retired recommendations preserve old chat text and metadata while allowing subsequent saves', () => {
  for (const id of ['ground', 'thought', 'plan', 'unknown']) {
    const messages = [{ role: 'assistant' as const, content: '原来的聊天内容', trainingState: 'saved',
      result: { action: 'reply', source: 'fallback', reply: '原来的聊天内容', exerciseId: id } as unknown as ChatReply }];
    const [restored] = restoreChatTraining(messages);
    assert.equal(restored.result.exerciseId, null);
    assert.equal(restored.content, messages[0].content);
    assert.equal(restored.trainingState, 'saved');
    assert.equal(messages[0].result.exerciseId, id);
  }
});
