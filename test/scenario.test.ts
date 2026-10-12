import test from 'node:test';
import assert from 'node:assert/strict';
import { assessRisk } from '../src/lib/safety';
import { fallbackScenarioReply, isScenarioTurnResponse, parseScenarioRequest, scenarioRisk, SCENARIO_ID, type ScenarioMessage } from '../src/lib/scenario';
import { aiConfiguration, chatCompletionsEndpoint, generateScenarioReply, parseModelReply } from '../src/server/ai-client';
import { allowScenarioRequest, clearRateLimitsForTests } from '../src/server/rate-limit';
import { POST } from '../src/app/api/scenario/turn/route';

const opening: ScenarioMessage = { role: 'assistant', content: '我只是开个玩笑。' };
const oneTurn: ScenarioMessage[] = [opening, { role: 'user', content: '你这样说让我不舒服，请停下来。' }];

test('safety corpus routes explicit risk signals and keeps ordinary distress in practice', () => {
  const unsafe = [
    '我想自杀', '我有自杀的念头', '我最近一直自伤', '我想死了', '我不想活了', '我不想活下去。', '我想结束生命',
    '我想伤害自己', '我想伤害别人', '我想杀了自己', '我正在被打', '我被家暴了', '我正在遭受虐待', '有人性侵我',
    '有人威胁我的人身安全', '活着没意思', '我想永远消失', '我真的撑不下去', '不如死了', '我希望醒不过来',
    '我无法保证自己的安全', '我控制不住自己的冲动', '我现在就要自伤', '我正在伤害自己', '我马上要跳楼',
    '我已经准备了很多药', '我手里有刀', '我身边有一根绳', '我有自杀计划', '我想好了自伤的方法',
  ];
  const safe = [
    '明天考试我很紧张', '我和同学吵架了', '今天心情很低落', '我想一个人待会儿', '我睡不着', '我担心成绩下降',
    '我不敢上台发言', '我觉得自己做不好', '我快累死了', '这题难死了', '我想死磕这道题', '我不想活跃发言',
    '老师批评我以后很难过', '我不喜欢同学开玩笑', '我想学会拒绝别人', '我今天没有动力', '我有点烦躁', '我觉得很孤单',
    '我害怕别人不喜欢我', '我想换一种沟通方式', '我希望他们停止评论成绩', '我需要休息一下', '这次考试对我很重要',
    '我想整理一下思路', '我和家长沟通不顺利',
  ];
  for (const value of unsafe) assert.equal(assessRisk(value).requiresHandoff, true, value);
  for (const value of safe) assert.equal(assessRisk(value).requiresHandoff, false, value);
});

test('scenario request validation enforces known scene, turn count, order and length', () => {
  assert.deepEqual(parseScenarioRequest({ scenarioId: SCENARIO_ID, messages: oneTurn }), { ok: true, value: { scenarioId: SCENARIO_ID, messages: oneTurn } });
  for (const value of [
    null,
    { scenarioId: 'other', messages: oneTurn },
    { scenarioId: SCENARIO_ID, messages: [] },
    { scenarioId: SCENARIO_ID, messages: [{ role: 'user', content: '' }] },
    { scenarioId: SCENARIO_ID, messages: [{ role: 'user', content: 'x'.repeat(501) }] },
    { scenarioId: SCENARIO_ID, messages: [{ role: 'assistant', content: '只有助手消息' }] },
    { scenarioId: SCENARIO_ID, messages: [{ role: 'user', content: 'a' }, { role: 'assistant', content: '结尾错误' }] },
  ]) assert.equal(parseScenarioRequest(value).ok, false);
});

test('scenario risk scans all user turns', () => {
  assert.equal(scenarioRisk([...oneTurn, { role: 'assistant', content: '好的' }, { role: 'user', content: '其实我不想活了' }]).requiresHandoff, true);
  assert.equal(scenarioRisk(oneTurn).requiresHandoff, false);
});

test('fallback is clearly labeled and completes after three user turns', () => {
  const first = fallbackScenarioReply(oneTurn, 'AI 尚未配置');
  assert.equal(first.source, 'fallback');
  assert.equal(first.action, 'continue');
  assert.match(first.coachHint, /预设情境/);
  const third = fallbackScenarioReply([...oneTurn, { role: 'assistant', content: '然后呢' }, { role: 'user', content: '请不要再说' }, { role: 'assistant', content: '知道了' }, { role: 'user', content: '谢谢你理解' }]);
  assert.equal(third.action, 'complete');
  assert.ok(third.feedback);
  assert.equal(isScenarioTurnResponse(third), true);
});

test('AI configuration requires both secret and base URL and normalizes endpoints', () => {
  assert.deepEqual(aiConfiguration({}), { configured: false, model: 'Qwen3.5-27B' });
  assert.deepEqual(aiConfiguration({ AI_API_KEY: 'key', AI_BASE_URL: 'https://example.com/v1', AI_MODEL: 'GLM-4.5' }), { configured: true, model: 'GLM-4.5' });
  assert.equal(chatCompletionsEndpoint('https://example.com/v1/'), 'https://example.com/v1/chat/completions');
  assert.equal(chatCompletionsEndpoint('https://example.com/chat/completions'), 'https://example.com/chat/completions');
  assert.throws(() => chatCompletionsEndpoint('not-a-url'));
});

test('model JSON parser accepts fenced output and rejects oversized or malformed values', () => {
  const parsed = parseModelReply('```json\n{"reply":"好的","coachHint":"说得具体","suggestions":["请停下来"]}\n```');
  assert.equal(parsed.reply, '好的');
  assert.deepEqual(parsed.suggestions, ['请停下来']);
  assert.throws(() => parseModelReply('普通文字'));
  assert.throws(() => parseModelReply(JSON.stringify({ reply: 'x'.repeat(301), coachHint: '提示', suggestions: [] })));
});

test('provider sends server credentials and returns validated AI content', async () => {
  let authorization = '', endpoint = '', requestBody: Record<string, unknown> = {};
  const fakeFetch = (async (input: string | URL | Request, init?: RequestInit) => {
    endpoint = String(input); authorization = new Headers(init?.headers).get('Authorization') || '';
    requestBody = JSON.parse(String(init?.body));
    return Response.json({ choices: [{ message: { content: JSON.stringify({ reply: '我知道了，你希望我怎么做？', coachHint: '提出具体请求。', suggestions: ['请不要再评论我的成绩。'] }) } }] });
  }) as typeof fetch;
  const result = await generateScenarioReply(oneTurn, { fetch: fakeFetch, env: { AI_API_KEY: 'secret-key', AI_BASE_URL: 'https://example.com/v1', AI_MODEL: 'Qwen3.5-27B' } });
  assert.equal(result.source, 'ai');
  assert.equal(endpoint, 'https://example.com/v1/chat/completions');
  assert.equal(authorization, 'Bearer secret-key');
  assert.equal(requestBody.model, 'Qwen3.5-27B');
  assert.ok(Array.isArray(requestBody.messages));
});

test('provider errors use a labeled fallback instead of leaking details', async () => {
  const fakeFetch = (async () => new Response('secret provider error', { status: 500 })) as typeof fetch;
  const result = await generateScenarioReply(oneTurn, { fetch: fakeFetch, env: { AI_API_KEY: 'secret-key', AI_BASE_URL: 'https://example.com/v1' } });
  assert.equal(result.source, 'fallback');
  assert.doesNotMatch(result.reply, /secret provider error/);
});

test('scenario route rejects bad origin and input, returns fallback, and stops unsafe dialogue', async () => {
  clearRateLimitsForTests();
  const crossSite = await POST(new Request('http://localhost/api/scenario/turn', { method: 'POST', headers: { origin: 'https://attacker.example', 'content-type': 'application/json' }, body: JSON.stringify({ scenarioId: SCENARIO_ID, messages: oneTurn }) }));
  assert.equal(crossSite.status, 403);
  const proxiedSameSite = await POST(new Request('http://internal:3000/api/scenario/turn', { method: 'POST', headers: { origin: 'https://mental.example', 'x-forwarded-host': 'mental.example', 'content-type': 'application/json', 'x-forwarded-for': 'proxy' }, body: JSON.stringify({ scenarioId: SCENARIO_ID, messages: oneTurn }) }));
  assert.equal(proxiedSameSite.status, 200);
  const invalid = await POST(new Request('http://localhost/api/scenario/turn', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': 'invalid' }, body: '{}' }));
  assert.equal(invalid.status, 400);
  const fallback = await POST(new Request('http://localhost/api/scenario/turn', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': 'fallback' }, body: JSON.stringify({ scenarioId: SCENARIO_ID, messages: oneTurn }) }));
  assert.equal(fallback.status, 200);
  assert.equal((await fallback.json()).source, 'fallback');
  const unsafeMessages = [opening, { role: 'user' as const, content: '我现在就要伤害自己' }];
  const unsafe = await POST(new Request('http://localhost/api/scenario/turn', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': 'unsafe' }, body: JSON.stringify({ scenarioId: SCENARIO_ID, messages: unsafeMessages }) }));
  const unsafePayload = await unsafe.json();
  assert.equal(unsafePayload.action, 'handoff');
  assert.equal(unsafePayload.source, 'safety');
});

test('in-memory MVP rate limit resets by window and stops excess model calls', () => {
  clearRateLimitsForTests();
  assert.equal(allowScenarioRequest('user', 0, 2, 100), true);
  assert.equal(allowScenarioRequest('user', 1, 2, 100), true);
  assert.equal(allowScenarioRequest('user', 2, 2, 100), false);
  assert.equal(allowScenarioRequest('user', 100, 2, 100), true);
});
