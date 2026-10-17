import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { generateChatReply } from '../src/server/chat-agent.js';
import { AIProviderError, classifyAIError, generateScenarioReply, requestModelText } from '../src/server/ai-client.js';
import { aiDiagnosticContext, type AIDiagnosticEvent } from '../src/server/ai-diagnostics.js';

const messages = [{ role: 'user' as const, content: '原样保存：\r\n引号"、反斜线\\和🌱' }];
const reply = '{"reply":"你好。","exerciseId":null,"needsSupport":false}';
const providerBody = (content: string) => JSON.stringify({ choices: [{ message: { content, reasoning_content: '原始推理字段' }, finish_reason: 'stop' }], usage: { total_tokens: 123 } });

async function setup(t: TestContext) {
  const directory = await mkdtemp(join(tmpdir(), 'xinqing-ai-interactions-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return { directory, env: { AI_API_KEY: 'never-log-this-key', AI_BASE_URL: 'https://provider.example/v1', AI_MODEL: 'test-model', AI_INTERACTION_LOG_DIR: directory } };
}

async function folders(directory: string) {
  const days = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(days.filter(day => day.isDirectory()).map(async day =>
    (await readdir(join(directory, day.name))).map(name => join(directory, day.name, name))))).flat();
}

async function records(directory: string) {
  return Promise.all((await folders(directory)).map(async folder => ({
    folder, request: await readFile(join(folder, 'request.json'), 'utf8'),
    response: await readFile(join(folder, 'response.txt')),
    metadata: JSON.parse(await readFile(join(folder, 'metadata.json'), 'utf8')),
  })));
}

test('exact request is on disk before fetch and raw response bytes survive decoding and validation', async t => {
  const { directory, env } = await setup(t);
  const text = ' \r\n```json\n' + reply + '\n``` \r\n';
  // Include a BOM, whitespace, CRLF, non-ASCII text and chunk boundaries inside UTF-8 sequences.
  const raw = Buffer.from('\uFEFF  \r\n' + providerBody(text) + '\r\n ');
  const provider = (async (_url, init) => {
    const [saved] = await records(directory);
    assert.equal(saved.request, init?.body);
    assert.equal(saved.metadata.state, 'started');
    assert.deepEqual(JSON.parse(saved.request).messages, [{ role: 'system', content: '完整系统提示词\r\n不裁剪' }, ...messages]);
    let offset = 0;
    return new Response(new ReadableStream({ pull(controller) {
      if (offset === raw.length) { controller.close(); return; }
      controller.enqueue(raw.subarray(offset, ++offset));
    } }), { headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  assert.equal(await requestModelText('完整系统提示词\r\n不裁剪', messages, { env, fetch: provider }, { requestId: 'request-exact', feature: 'chat', attempt: 2 }), text);
  const [saved] = await records(directory);
  assert.deepEqual(saved.response, raw);
  assert.equal(await readFile(join(saved.folder, 'model-content.txt'), 'utf8'), text);
  assert.equal(saved.metadata.requestId, 'request-exact');
  assert.equal(saved.metadata.attempt, 2);
  assert.equal(saved.metadata.feature, 'chat');
  assert.equal(saved.metadata.responseComplete, true);
  assert.equal(saved.metadata.responseBytes, raw.length);
  assert.equal(saved.metadata.providerStatus, 200);
  assert.equal(saved.metadata.state, 'response_received');
  assert.doesNotMatch(saved.request + JSON.stringify(saved.metadata), /never-log-this-key|Authorization/);
});

test('real HTTP transport to a local provider preserves the transmitted request and received response', async t => {
  const { directory, env } = await setup(t);
  const rawResponse = Buffer.from(' \r\n' + providerBody(reply) + '\r\n ');
  let transmitted = Buffer.alloc(0);
  let requestExistedBeforeSending = false;
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    transmitted = Buffer.concat(chunks);
    const [saved] = await records(directory);
    requestExistedBeforeSending = saved.request === transmitted.toString('utf8');
    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    response.write(rawResponse.subarray(0, 17));
    response.end(rawResponse.subarray(17));
  });
  t.after(() => new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  assert.equal(await requestModelText('本机传输验证', messages, { env: { ...env, AI_BASE_URL: `http://127.0.0.1:${address.port}/v1` }, fetch }), reply);
  const [saved] = await records(directory);
  assert.ok(requestExistedBeforeSending);
  assert.deepEqual(Buffer.from(saved.request, 'utf8'), transmitted);
  assert.deepEqual(saved.response, rawResponse);
});

test('both malformed chat attempts retain separate complete bodies and share the diagnostic request ID', async t => {
  const { directory, env } = await setup(t);
  const contents = ['', '这里是解释\n{"reply":坏JSON}'];
  const bodies = contents.map(providerBody);
  let calls = 0;
  const diagnostics: AIDiagnosticEvent[] = [];
  const result = await generateChatReply(messages, { env, fetch: (async () => new Response(bodies[calls++])) as typeof fetch }, aiDiagnosticContext('chat', 'chat-retry', event => diagnostics.push(event)));
  assert.equal(result.source, 'fallback');
  const saved = (await records(directory)).sort((a, b) => a.metadata.attempt - b.metadata.attempt);
  assert.equal(saved.length, 2);
  assert.notEqual(saved[0].folder, saved[1].folder);
  for (let i = 0; i < 2; i++) {
    assert.equal(saved[i].response.toString(), bodies[i]);
    assert.equal(await readFile(join(saved[i].folder, 'model-content.txt'), 'utf8'), contents[i]);
    assert.equal(saved[i].metadata.requestId, 'chat-retry');
    assert.equal(saved[i].metadata.attempt, i + 1);
    assert.equal(saved[i].metadata.feature, 'chat');
  }
  assert.deepEqual(diagnostics.slice(0, 2).map(event => event.reason), ['invalid_json', 'invalid_json']);
});

test('HTTP errors and malformed provider envelopes are stored before being rejected', async t => {
  const { directory, env } = await setup(t);
  for (const [status, raw, reason] of [
    [429, '  上游限流\r\n<html>error</html>  ', 'provider_http'],
    [200, ' \nnot JSON\n ', 'provider_invalid_response'],
    [200, '{"choices":[]}', 'provider_invalid_response'],
  ] as const) {
    await assert.rejects(requestModelText('prompt', messages, { env, fetch: (async () => new Response(raw, { status })) as typeof fetch }), error => {
      assert.ok(error instanceof AIProviderError); assert.equal(error.reason, reason); return true;
    });
    const saved = (await records(directory)).find(record => record.response.toString() === raw)!;
    assert.ok(saved);
    assert.equal(saved.metadata.providerStatus, status);
    assert.equal(saved.metadata.reason, reason);
    assert.equal(saved.metadata.responseComplete, true);
  }
});

test('network failures, timeouts and interrupted response streams leave request and partial response evidence', async t => {
  const { directory, env } = await setup(t);
  for (const [error, reason] of [[new TypeError('private network details'), 'provider_network'], [new DOMException('timeout', 'TimeoutError'), 'provider_timeout']] as const) {
    await assert.rejects(requestModelText('prompt', messages, { env, fetch: (async () => { throw error; }) as typeof fetch }, { requestId: reason, feature: 'chat', attempt: 1 }));
    const saved = (await records(directory)).find(record => record.metadata.requestId === reason)!;
    assert.equal(saved.response.length, 0);
    assert.equal(saved.metadata.reason, reason);
    assert.equal(saved.metadata.responseComplete, false);
    assert.doesNotMatch(JSON.stringify(saved.metadata), /private network details/);
  }
  const partial = Buffer.from('前半段\r\n{"choices":');
  let pulls = 0;
  const fetchPartial = (async () => new Response(new ReadableStream({ pull(controller) {
    if (pulls++ === 0) controller.enqueue(partial);
    else controller.error(new DOMException('interrupted', 'AbortError'));
  } }, { highWaterMark: 0 }))) as typeof fetch;
  await assert.rejects(requestModelText('prompt', messages, { env, fetch: fetchPartial }, { requestId: 'partial', feature: 'chat', attempt: 1 }));
  const saved = (await records(directory)).find(record => record.metadata.requestId === 'partial')!;
  assert.deepEqual(saved.response, partial);
  assert.equal(saved.metadata.providerStatus, 200);
  assert.equal(saved.metadata.reason, 'provider_timeout');
  assert.equal(saved.metadata.responseComplete, false);
});

test('scenario calls and concurrent chat calls keep their own bodies and request IDs', async t => {
  const { directory, env } = await setup(t);
  const scenarioBody = providerBody('{"reply":"好的","coachHint":"清楚表达","suggestions":[]}');
  const scenario = await generateScenarioReply(messages, { env, fetch: (async () => new Response(scenarioBody)) as typeof fetch }, aiDiagnosticContext('scenario', 'scenario-request', () => {}));
  assert.equal(scenario.source, 'ai');
  await Promise.all(Array.from({ length: 8 }, (_, index) => requestModelText(`prompt-${index}`, messages,
    { env, fetch: (async () => new Response(providerBody(`raw-${index}`))) as typeof fetch },
    { requestId: `parallel-${index}`, feature: 'chat', attempt: 1 })));
  const saved = await records(directory);
  assert.equal(saved.length, 9);
  const scenarioRecord = saved.find(record => record.metadata.requestId === 'scenario-request')!;
  assert.equal(scenarioRecord.metadata.feature, 'scenario');
  assert.equal(scenarioRecord.response.toString(), scenarioBody);
  for (let index = 0; index < 8; index++) {
    const record = saved.find(record => record.metadata.requestId === `parallel-${index}`)!;
    assert.equal(JSON.parse(record.request).messages[0].content, `prompt-${index}`);
    assert.equal(record.response.toString(), providerBody(`raw-${index}`));
  }
});

test('an unavailable log directory prevents unrecorded external calls', async t => {
  const { directory, env } = await setup(t);
  const blocked = join(directory, 'file-instead-of-directory');
  await writeFile(blocked, 'block');
  let calls = 0;
  await assert.rejects(requestModelText('prompt', messages, { env: { ...env, AI_INTERACTION_LOG_DIR: blocked }, fetch: (async () => { calls++; return new Response(providerBody(reply)); }) as typeof fetch }), error => {
    assert.deepEqual(classifyAIError(error), { reason: 'interaction_log_failed' }); return true;
  });
  assert.equal(calls, 0);
});
