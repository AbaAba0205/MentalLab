import test from 'node:test';
import assert from 'node:assert/strict';
import { generateChatReply } from '../src/server/chat-agent.js';
import { AIProviderError, classifyAIError, generateScenarioReply, requestModelText } from '../src/server/ai-client.js';
import { aiDiagnosticContext, writeAIDiagnostic, type AIDiagnosticEvent } from '../src/server/ai-diagnostics.js';
import type { ChatMessage } from '../src/lib/chat.js';
import type { ScenarioMessage } from '../src/lib/scenario.js';
import { Store, sessionCookie } from '../src/database.js';
import { createApplication } from '../src/application.js';
import { POST as chatTurn } from '../src/routes/chat.js';
import { POST as scenarioTurn } from '../src/routes/scenario.js';
import { SCENARIO_ID } from '../src/lib/scenario.js';

const env = { AI_API_KEY: 'diagnostic-secret', AI_BASE_URL: 'https://provider.example/v1', AI_MODEL: 'test-model' };
const chat: ChatMessage[] = [{ role: 'user', content: 'private-user-text' }];
const scenario: ScenarioMessage[] = [{ role: 'assistant', content: 'opening' }, { role: 'user', content: 'private-scenario-text' }];
const success = { reply: '可以慢慢说。', needsSupport: false, exerciseId: null };

function capture(feature: 'chat' | 'scenario' = 'chat') {
  const events: AIDiagnosticEvent[] = [];
  return { events, diagnostics: aiDiagnosticContext(feature, 'request-123', event => events.push(event)) };
}

test('chat diagnostics record retry reason, duration and eventual success without message content', async () => {
  const { events, diagnostics } = capture();
  let calls = 0;
  const provider = (async () => Response.json({ choices: [{ message: { content: ++calls === 1 ? '{broken' : JSON.stringify(success) } }] })) as typeof fetch;
  const result = await generateChatReply(chat, { env, fetch: provider }, diagnostics);
  assert.equal(result.source, 'ai');
  assert.deepEqual(events.map(event => [event.event, event.outcome, event.reason]), [
    ['ai_attempt', 'failure', 'invalid_json'], ['ai_attempt', 'success', undefined], ['ai_request', 'success', undefined],
  ]);
  assert.ok(events.every(event => event.requestId === 'request-123' && event.feature === 'chat' && event.durationMs >= 0 && event.model === 'test-model'));
  const serialized = JSON.stringify(events);
  assert.doesNotMatch(serialized, /private-user-text|diagnostic-secret|provider\.example|可以慢慢说/);
});

test('chat diagnostics distinguish validation failures and finish with a fallback summary', async () => {
  for (const [payload, expected] of [
    [{ reply: '', needsSupport: false, exerciseId: null }, 'invalid_schema'],
    [{ reply: 'x'.repeat(601), needsSupport: false, exerciseId: null }, 'response_too_long'],
    [{ reply: '请访问 https://bad.example', needsSupport: false, exerciseId: null }, 'unsafe_text'],
    [{ reply: '试试分析。', needsSupport: false, exerciseId: 'describe-facts' }, 'ineligible_exercise'],
  ] as const) {
    const { events, diagnostics } = capture();
    const provider = (async () => Response.json({ choices: [{ message: { content: JSON.stringify(payload) } }] })) as typeof fetch;
    assert.equal((await generateChatReply(chat, { env, fetch: provider }, diagnostics)).source, 'fallback');
    assert.equal(events.length, 3);
    assert.deepEqual(events.slice(0, 2).map(event => event.reason), [expected, expected]);
    assert.deepEqual([events[2].event, events[2].outcome, events[2].reason], ['ai_request', 'fallback', 'fallback']);
  }
});

test('provider failures expose only stable categories and HTTP status', async () => {
  const cases: Array<[typeof fetch, string, number | undefined]> = [
    [(async () => new Response('secret response body', { status: 429 })) as typeof fetch, 'provider_http', 429],
    [(async () => { throw new DOMException('secret timeout detail', 'TimeoutError'); }) as typeof fetch, 'provider_timeout', undefined],
    [(async () => { throw new Error('secret network detail'); }) as typeof fetch, 'provider_network', undefined],
    [(async () => Response.json({ unexpected: 'secret payload' })) as typeof fetch, 'provider_invalid_response', 200],
    [(async () => new Response('not-json')) as typeof fetch, 'provider_invalid_response', 200],
  ];
  for (const [provider, reason, status] of cases) {
    await assert.rejects(() => requestModelText('private prompt', scenario, { env, fetch: provider }), error => {
      assert.ok(error instanceof AIProviderError); assert.equal(error.reason, reason); assert.equal(error.providerStatus, status);
      assert.doesNotMatch(error.message, /secret|private|provider\.example/); return true;
    });
  }
  assert.deepEqual(classifyAIError(new SyntaxError('private invalid JSON')), { reason: 'invalid_json' });
});

test('two failed provider calls retain their separate causes before the fallback summary', async () => {
  const { events, diagnostics } = capture();
  let calls = 0;
  const provider = (async () => {
    if (++calls === 1) throw new DOMException('private timeout details', 'TimeoutError');
    return new Response('private rejection body', { status: 503 });
  }) as typeof fetch;
  const result = await generateChatReply(chat, { env, fetch: provider }, diagnostics);
  assert.equal(result.source, 'fallback'); assert.equal(calls, 2);
  assert.deepEqual(events.map(event => [event.attempt, event.reason, event.providerStatus]), [
    [1, 'provider_timeout', undefined], [2, 'provider_http', 503], [undefined, 'fallback', undefined],
  ]);
  assert.ok(events[2].durationMs >= Math.max(events[0].durationMs, events[1].durationMs) - 1);
  assert.doesNotMatch(JSON.stringify(events), /private|diagnostic-secret/);
});

test('response-body timeouts and network failures keep their categories after receiving HTTP headers', async () => {
  for (const [error, reason] of [[new DOMException('private abort detail', 'AbortError'), 'provider_timeout'], [new TypeError('private stream detail'), 'provider_network']] as const) {
    const provider = (async () => new Response(new ReadableStream({ start(controller) { controller.error(error); } }))) as typeof fetch;
    await assert.rejects(() => requestModelText('private prompt', scenario, { env, fetch: provider }), failure => {
      assert.ok(failure instanceof AIProviderError); assert.equal(failure.reason, reason); assert.equal(failure.providerStatus, 200); return true;
    });
  }
});

test('missing or invalid configuration is diagnosed without exposing endpoint values', async () => {
  for (const [configuration, reason] of [[{}, 'provider_not_configured'], [{ ...env, AI_BASE_URL: 'not-a-url-secret' }, 'provider_config']] as const) {
    const { events, diagnostics } = capture();
    let calls = 0;
    const provider = (async () => { calls++; throw new Error('should not fetch'); }) as typeof fetch;
    assert.equal((await generateChatReply(chat, { env: configuration, fetch: provider }, diagnostics)).source, 'fallback');
    assert.equal(calls, 0); assert.deepEqual(events.filter(event => event.event === 'ai_attempt').map(event => event.reason), [reason, reason]);
    assert.doesNotMatch(JSON.stringify(events), /not-a-url-secret|diagnostic-secret/);
  }
});

test('scenario success, invalid JSON and invalid schema have distinct diagnostics', async () => {
  for (const [raw, reason] of [['plain text', 'invalid_json'], ['{}', 'invalid_schema'], [JSON.stringify({ reply: '好的。', coachHint: '可以提出具体请求。', suggestions: [] }), undefined]] as const) {
    const { events, diagnostics } = capture('scenario');
    const provider = (async () => Response.json({ choices: [{ message: { content: raw } }] })) as typeof fetch;
    const result = await generateScenarioReply(scenario, { env, fetch: provider }, diagnostics);
    assert.equal(result.source, reason ? 'fallback' : 'ai');
    assert.equal(events.length, 2); assert.equal(events[0].reason, reason);
    assert.equal(events[1].outcome, reason ? 'fallback' : 'success');
  }
});

test('a broken diagnostic sink never retries or replaces a successful AI reply', async () => {
  const diagnostics = aiDiagnosticContext('chat', 'request-123', () => { throw new Error('log sink unavailable'); });
  let calls = 0;
  const provider = (async () => { calls++; return Response.json({ choices: [{ message: { content: JSON.stringify(success) } }] }); }) as typeof fetch;
  assert.equal((await generateChatReply(chat, { env, fetch: provider }, diagnostics)).source, 'ai');
  assert.equal(calls, 1);
});

test('HTTP diagnostics correlate authentication, validation, throttling and handoff with response headers', async t => {
  const store = new Store(':memory:'); t.after(() => store.close());
  const events: AIDiagnosticEvent[] = [];
  const app = createApplication(store, { aiLogger: event => events.push(event) });
  const user = await store.createUser('diagnostics@example.com', '测试', 'Test-password-2026');
  const token = `${sessionCookie}=${store.login(user.id)}`;
  async function call(body: string, cookie = token, extra: Record<string, string> = {}, path = '/api/chat/turn') {
    return app(new Request(`http://localhost${path}`, { method: 'POST', headers: { 'content-type': 'application/json', cookie, 'x-request-id': 'untrusted-private-id', ...extra }, body }));
  }
  const cases: Array<[() => Promise<Response>, number, string | undefined]> = [
    [() => call('{}', ''), 401, 'authentication_required'],
    [() => call('{}', token, { origin: 'https://evil.example' }), 403, 'request_forbidden'],
    [() => call('{broken'), 400, 'invalid_request'],
    [() => call(JSON.stringify({ messages: [{ role: 'user', content: '我不想活了' }] })), 200, undefined],
    [() => call('{broken', token, {}, '/api/scenario/turn'), 400, 'invalid_request'],
  ];
  const ids: string[] = [];
  for (const [request, status, reason] of cases) {
    events.length = 0;
    const response = await request(), id = response.headers.get('x-request-id')!;
    assert.equal(response.status, status); assert.match(id, /^[a-f0-9-]{36}$/); ids.push(id);
    assert.ok(events.every(event => event.requestId === id));
    assert.equal(events[0].outcome, 'started');
    const completed = events.at(-1)!;
    assert.equal(completed.event, 'ai_http'); assert.equal(completed.responseStatus, status); assert.equal(completed.reason, reason);
    assert.doesNotMatch(JSON.stringify(events), /untrusted-private-id|diagnostics@example\.com|evil\.example|我不想活了|xinqing_session/);
  }
  assert.equal(new Set(ids).size, ids.length);
  store.db.prepare('INSERT INTO limits VALUES (?,?,?)').run(`ai:${user.id}`, 12, Date.now() + 60000);
  events.length = 0;
  const limited = await call(JSON.stringify({ messages: chat }));
  assert.equal(limited.status, 429); assert.equal(events.at(-1)!.reason, 'rate_limited');
  assert.equal(events.some(event => event.event === 'ai_attempt'), false);
});

test('chat and scenario routes retain the supplied request ID across safety handoffs', async () => {
  for (const feature of ['chat', 'scenario'] as const) {
    const { events, diagnostics } = capture(feature);
    const messages = feature === 'chat' ? [{ role: 'user', content: '我正在伤害自己' }] : [{ role: 'assistant', content: 'opening' }, { role: 'user', content: '我正在伤害自己' }];
    const request = new Request(`http://localhost/api/${feature}/turn`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ scenarioId: SCENARIO_ID, messages }) });
    const response = await (feature === 'chat' ? chatTurn(request, diagnostics) : scenarioTurn(request, diagnostics));
    assert.equal(response.headers.get('x-request-id'), 'request-123'); assert.equal((await response.json()).source, 'safety');
    assert.equal(events[0].reason, 'local_safety_handoff'); assert.equal(events.some(event => event.event === 'ai_attempt'), false);
  }
});

test('scenario diagnostics record provider failures and fallback without payloads', async () => {
  const { events, diagnostics } = capture('scenario');
  const provider = (async () => new Response('private provider body', { status: 503 })) as typeof fetch;
  const result = await generateScenarioReply(scenario, { env, fetch: provider }, diagnostics);
  assert.equal(result.source, 'fallback');
  assert.deepEqual(events.map(event => [event.event, event.outcome, event.reason, event.providerStatus]), [
    ['ai_attempt', 'failure', 'provider_http', 503], ['ai_request', 'fallback', 'provider_http', 503],
  ]);
  assert.doesNotMatch(JSON.stringify(events), /private|diagnostic-secret|provider\.example/);
});

test('default diagnostic writer emits one parseable JSON line with no implicit data', () => {
  let line = '';
  const original = console.info;
  console.info = value => { line = String(value); };
  const event: AIDiagnosticEvent = { event: 'ai_attempt', requestId: 'request-123', feature: 'chat', outcome: 'failure', reason: 'provider_http', providerStatus: 401, attempt: 1, durationMs: 12, model: 'test-model' };
  Object.assign(event, { messages: chat, reply: 'private reply', headers: { authorization: 'Bearer diagnostic-secret' }, error: new Error('private detail') });
  try { writeAIDiagnostic(event); }
  finally { console.info = original; }
  const value = JSON.parse(line);
  assert.equal(value.component, 'xinqing-ai'); assert.equal(value.requestId, 'request-123'); assert.equal(value.providerStatus, 401);
  assert.equal(typeof value.timestamp, 'string'); assert.equal(Object.keys(value).some(key => /message|prompt|reply|key|cookie/i.test(key)), false);
  assert.doesNotMatch(line, /private|diagnostic-secret|authorization/);
});
