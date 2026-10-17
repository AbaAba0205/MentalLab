import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { companionPrompt, acceptableCompanionText } from '../src/server/chat-agent.js';
import { aiConfiguration, chatCompletionsEndpoint, type AIEnvironment } from '../src/server/ai-client.js';
import { AIInteractionLogError, startAIInteraction } from '../src/server/ai-interactions.js';
import { allowedTraining, type ChatMessage } from '../src/lib/chat.js';

export const variants = ['current', 'strong_prompt', 'json_history', 'json_mode'] as const;
export type Variant = typeof variants[number];
export const cases: { id: string; messages: ChatMessage[] }[] = [
  { id: 'greeting', messages: [{ role: 'user', content: '你好' }] },
  { id: 'relationship', messages: [
    { role: 'user', content: '今天朋友不开心了，我该怎么安慰她' },
    { role: 'assistant', content: '你很在意她。你知道她是因为什么不开心吗？' },
    { role: 'user', content: '因为我刚才态度有点不好，情绪上头了' },
  ] },
  { id: 'return_to_chat', messages: [
    { role: 'user', content: '今天和同学闹别扭了' },
    { role: 'assistant', content: '愿意说说发生了什么吗？' },
    { role: 'user', content: '我说话太急了，想跟她道歉' },
    { role: 'assistant', content: '可以先承认刚才的具体行为，再表达你在意她的感受。' },
    { role: 'user', content: '你好' },
  ] },
];

const formatRule = `输出协议（每一轮都必须遵守）：最终回答只能是一个合法 JSON 对象，包含且仅包含 reply、exerciseId、needsSupport 三个字段。reply 是字符串，exerciseId 是训练目录中的 id 或 null，needsSupport 是布尔值。所有对用户说的中文都必须放在 reply 字符串内，不得在 JSON 前后输出解释、普通聊天文字或 Markdown。历史 assistant 消息是界面解包后的文字，不是输出格式示例。`;
export const strongPrompt = formatRule + '\n\n' + companionPrompt + `\n\n${formatRule}\n普通聊天的格式示例：{"reply":"你好，今天想聊些什么？","exerciseId":null,"needsSupport":false}\n需要现实支持的格式示例：{"reply":"我们先照顾现实中的安全。","exerciseId":null,"needsSupport":true}\n发送前检查 JSON 语法、字段名称和字段类型。`;

export function evaluationBody(variant: Variant, messages: ChatMessage[], model: string) {
  return JSON.stringify({ model, temperature: 0.6, max_tokens: 700,
    messages: [{ role: 'system', content: variant === 'strong_prompt' ? strongPrompt : companionPrompt },
      ...messages.map(message => variant === 'json_history' && message.role === 'assistant'
        ? { ...message, content: JSON.stringify({ reply: message.content, exerciseId: null, needsSupport: false }) } : message)],
    ...(variant === 'json_mode' ? { response_format: { type: 'json_object' } } : {}),
  });
}

/** Match the production parser and its acceptance gates; also measure stricter JSON separately. */
export function evaluateContent(content: string, messages: ChatMessage[]) {
  let strictJson = false;
  try { JSON.parse(content); strictJson = true; } catch { /* Report separately from fenced JSON accepted by the app. */ }
  let value: unknown;
  try { value = JSON.parse(content.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()); }
  catch { return { strictJson, accepted: false, reason: 'invalid_json' }; }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { strictJson, accepted: false, reason: 'invalid_schema' };
  const result = value as Record<string, unknown>;
  if (result.needsSupport === true) return { strictJson, accepted: true, reason: 'safety_handoff' };
  if (Object.keys(result).length !== 3 || !['reply', 'exerciseId', 'needsSupport'].every(key => Object.hasOwn(result, key))
    || result.needsSupport !== false || typeof result.reply !== 'string' || !result.reply.trim()) return { strictJson, accepted: false, reason: 'invalid_schema' };
  if (result.reply.length > 600) return { strictJson, accepted: false, reason: 'response_too_long' };
  if (!acceptableCompanionText(result.reply)) return { strictJson, accepted: false, reason: 'unsafe_text' };
  if (result.exerciseId !== null && !allowedTraining(result.exerciseId, messages)) return { strictJson, accepted: false, reason: 'ineligible_exercise' };
  return { strictJson, accepted: true, reason: 'accepted' };
}

export interface EvaluationResult {
  requestId: string; variant: Variant; caseId: string; repetition: number; durationMs: number;
  httpStatus?: number; finishReason?: unknown; usage?: unknown;
  content?: string; strictJson: boolean; accepted: boolean; reason: string;
}

export function evaluationSchedule(repetitions: number) {
  const schedule: { variant: Variant; caseId: string; messages: ChatMessage[]; repetition: number }[] = [];
  for (let repetition = 1; repetition <= repetitions; repetition++) {
    for (const [index, sample] of cases.entries()) {
      const rotation = (repetition - 1 + index) % variants.length;
      for (let offset = 0; offset < variants.length; offset++) {
        schedule.push({ variant: variants[(rotation + offset) % variants.length], ...sample, caseId: sample.id, repetition });
      }
    }
  }
  return schedule;
}

export async function runEvaluationCall(
  trial: ReturnType<typeof evaluationSchedule>[number], env: AIEnvironment, requestId: string, provider: typeof fetch = fetch,
): Promise<EvaluationResult> {
  const config = aiConfiguration(env);
  if (!config.configured) throw new Error('Provider is not configured');
  const body = evaluationBody(trial.variant, trial.messages, config.model);
  const started = performance.now();
  const interaction = await startAIInteraction(body, config.model, { requestId, feature: 'chat', attempt: 1 }, env.AI_INTERACTION_LOG_DIR);
  let response: Response | undefined;
  let complete = false;
  let stage = 'transport';
  try {
    response = await provider(chatCompletionsEndpoint(env.AI_BASE_URL!), {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + env.AI_API_KEY!.trim() },
      body, signal: AbortSignal.timeout(15_000), cache: 'no-store',
    });
    await interaction.responseHeaders(response);
    const chunks: Uint8Array[] = [];
    if (response.body) {
      const reader = response.body.getReader();
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          await interaction.responseChunk(chunk.value);
          chunks.push(chunk.value);
        }
      } catch (error) { await reader.cancel().catch(() => {}); throw error; }
      finally { reader.releaseLock(); }
    }
    complete = true;
    if (!response.ok) {
      await interaction.finish(response, 'provider_http', true);
      return { requestId, variant: trial.variant, caseId: trial.caseId, repetition: trial.repetition, durationMs: Math.round(performance.now() - started), httpStatus: response.status, strictJson: false, accepted: false, reason: 'provider_http' };
    }
    stage = 'envelope';
    const payload = JSON.parse(new TextDecoder().decode(Buffer.concat(chunks)));
    const choice = payload.choices?.[0];
    const content = choice?.message?.content;
    if (typeof content !== 'string') throw new Error('Missing model content');
    await interaction.modelText(content);
    await interaction.finish(response, undefined, true);
    return { requestId, variant: trial.variant, caseId: trial.caseId, repetition: trial.repetition,
      durationMs: Math.round(performance.now() - started), httpStatus: response.status,
      finishReason: choice.finish_reason, usage: payload.usage, content, ...evaluateContent(content, trial.messages) };
  } catch (error) {
    // Stop the experiment if archiving fails instead of counting it as a provider failure.
    if (error instanceof AIInteractionLogError) throw error;
    const name = error instanceof Error ? error.name : '';
    const reason = name === 'TimeoutError' || name === 'AbortError' ? 'provider_timeout' : stage === 'envelope' ? 'provider_invalid_response' : 'provider_network';
    await interaction.finish(response, reason, complete);
    return { requestId, variant: trial.variant, caseId: trial.caseId, repetition: trial.repetition, durationMs: Math.round(performance.now() - started), httpStatus: response?.status, strictJson: false, accepted: false, reason };
  }
}

export function summarize(results: EvaluationResult[]) {
  return variants.map(variant => {
    const group = results.filter(result => result.variant === variant);
    const completed = group.filter(result => result.httpStatus === 200 && result.content !== undefined);
    const durations = group.map(result => result.durationMs).sort((a, b) => a - b);
    return { variant, calls: group.length, http200WithContent: completed.length,
      strictJson: group.filter(result => result.strictJson).length, accepted: group.filter(result => result.accepted).length,
      invalidJson: group.filter(result => result.reason === 'invalid_json').length,
      timeouts: group.filter(result => result.reason === 'provider_timeout').length,
      medianMs: durations.length ? (durations[Math.floor((durations.length - 1) / 2)] + durations[Math.floor(durations.length / 2)]) / 2 : null,
    };
  });
}

async function main() {
  const env = process.env as AIEnvironment;
  if (!aiConfiguration(env).configured) throw new Error('Configure the existing provider before running this live evaluation.');
  const evaluationId = `prompt-evaluation-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
  const directory = resolve('./data/ai-prompt-evaluations', evaluationId);
  await mkdir(directory, { recursive: true });
  const schedule = evaluationSchedule(3);
  await writeFile(join(directory, 'plan.json'), JSON.stringify({ evaluationId, model: aiConfiguration(env).model,
    repetitions: 3, variants, cases, schedule: schedule.map(({ variant, caseId, repetition }) => ({ variant, caseId, repetition })),
    parameters: { temperature: 0.6, max_tokens: 700, timeoutMs: 15000, retries: 0, concurrency: 1 },
  }, null, 2));
  const results: EvaluationResult[] = [];
  console.log(JSON.stringify({ evaluationId, directory, calls: schedule.length }));
  for (const [index, trial] of schedule.entries()) {
    const result = await runEvaluationCall(trial, env, `${evaluationId}-${index + 1}`);
    results.push(result);
    await writeFile(join(directory, 'results.json'), JSON.stringify({ evaluationId, completed: results.length, planned: schedule.length, summary: summarize(results), results }, null, 2));
    console.log(JSON.stringify({ progress: `${index + 1}/${schedule.length}`, variant: trial.variant, caseId: trial.caseId,
      accepted: result.accepted, reason: result.reason, durationMs: result.durationMs, finishReason: result.finishReason }));
  }
  console.log(JSON.stringify({ directory, summary: summarize(results) }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
