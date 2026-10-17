import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { cases, variants, evaluationBody, evaluationSchedule, evaluateContent, runEvaluationCall, summarize } from '../scripts/evaluate-ai-prompts.js';
import { companionPrompt } from '../src/server/chat-agent.js';

test('evaluation changes one experimental factor and keeps production generation parameters', () => {
  const messages = cases[1].messages;
  const current = JSON.parse(evaluationBody('current', messages, 'test-model'));
  assert.deepEqual(current, { model: 'test-model', temperature: 0.6, max_tokens: 700, messages: [{ role: 'system', content: companionPrompt }, ...messages] });
  const strong = JSON.parse(evaluationBody('strong_prompt', messages, 'test-model'));
  assert.deepEqual({ ...strong, messages: current.messages }, current);
  assert.deepEqual(strong.messages.slice(1), current.messages.slice(1));
  assert.ok(strong.messages[0].content.includes(companionPrompt));
  const history = JSON.parse(evaluationBody('json_history', messages, 'test-model'));
  assert.equal(history.messages[0].content, companionPrompt);
  for (let index = 0; index < messages.length; index++) {
    const message = history.messages[index + 1];
    if (message.role === 'assistant') assert.equal(JSON.parse(message.content).reply, messages[index].content);
    else assert.deepEqual(message, messages[index]);
  }
  const mode = JSON.parse(evaluationBody('json_mode', messages, 'test-model'));
  assert.deepEqual(mode, { ...current, response_format: { type: 'json_object' } });
});

test('all arms receive identical cases and repetitions in rotating order with no automatic retry', () => {
  const schedule = evaluationSchedule(3);
  assert.equal(schedule.length, 36);
  for (const variant of variants) for (const sample of cases) {
    const trials = schedule.filter(trial => trial.variant === variant && trial.caseId === sample.id);
    assert.deepEqual(trials.map(trial => trial.repetition), [1, 2, 3]);
    assert.ok(trials.every(trial => trial.messages === sample.messages));
  }
  assert.notEqual(schedule[0].variant, schedule[4].variant);
});

test('evaluation separates syntax failures, schema failures, unsafe text and acceptable replies', () => {
  const messages = cases[0].messages;
  assert.equal(evaluateContent('你好', messages).reason, 'invalid_json');
  assert.equal(evaluateContent('{}', messages).reason, 'invalid_schema');
  assert.equal(evaluateContent('{"reply":"你好","needsSupport":false}', messages).reason, 'ineligible_exercise');
  assert.equal(evaluateContent('{"reply":"你必须听我的","exerciseId":null,"needsSupport":false}', messages).reason, 'unsafe_text');
  assert.deepEqual(evaluateContent('{"reply":"你好","exerciseId":null,"needsSupport":false}', messages), { strictJson: true, accepted: true, reason: 'accepted' });
  assert.deepEqual(evaluateContent('```json\n{"reply":"你好","exerciseId":null,"needsSupport":false}\n```', messages), { strictJson: false, accepted: true, reason: 'accepted' });
});

test('the live runner preserves exact experimental bodies and counts provider failures separately', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'xinqing-prompt-evaluation-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const env = { AI_API_KEY: 'test-secret', AI_BASE_URL: 'https://provider.example/v1', AI_MODEL: 'test-model', AI_INTERACTION_LOG_DIR: directory };
  const trial = evaluationSchedule(1).find(trial => trial.variant === 'json_mode')!;
  const raw = ' {"choices":[{"message":{"content":"你好"},"finish_reason":"stop"}],"usage":{"completion_tokens":3}}\r\n';
  const response = await runEvaluationCall(trial, env, 'evaluation-test', (async (_url, init) => {
    assert.deepEqual(JSON.parse(String(init?.body)), JSON.parse(evaluationBody('json_mode', trial.messages, env.AI_MODEL)));
    return new Response(raw);
  }) as typeof fetch);
  assert.equal(response.reason, 'invalid_json');
  assert.equal(response.httpStatus, 200);
  const day = (await readdir(directory))[0];
  const folder = join(directory, day, (await readdir(join(directory, day)))[0]);
  assert.equal(await readFile(join(folder, 'response.txt'), 'utf8'), raw);
  assert.equal(await readFile(join(folder, 'request.json'), 'utf8'), evaluationBody('json_mode', trial.messages, env.AI_MODEL));
  const unsupported = await runEvaluationCall(trial, env, 'unsupported', (async () => new Response('unsupported response_format', { status: 400 })) as typeof fetch);
  assert.equal(unsupported.reason, 'provider_http');
  const summary = summarize([response, unsupported]).find(group => group.variant === 'json_mode')!;
  assert.equal(summary.calls, 2); assert.equal(summary.http200WithContent, 1); assert.equal(summary.invalidJson, 1); assert.equal(summary.accepted, 0);
});
