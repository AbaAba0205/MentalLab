import { randomUUID } from 'node:crypto';
import { fallbackScenarioReply, MAX_SCENARIO_TURNS, type ScenarioMessage, type ScenarioTurnResponse } from '../lib/scenario.js';
import { diagnosticDuration, type AIDiagnosticContext, type AIDiagnosticReason } from './ai-diagnostics.js';
import { AIInteractionLogError, startAIInteraction, type AIInteractionContext } from './ai-interactions.js';

export interface AIEnvironment {
  AI_API_KEY?: string;
  AI_BASE_URL?: string;
  AI_MODEL?: string;
  AI_INTERACTION_LOG_DIR?: string;
}

export interface ProviderDependencies {
  fetch: typeof fetch;
  env: AIEnvironment;
}

interface ModelReply {
  reply: string;
  coachHint: string;
  suggestions: string[];
  feedback?: string;
}

export class AIProviderError extends Error {
  constructor(public reason: AIDiagnosticReason, public providerStatus?: number) { super(reason); }
}

export function aiConfiguration(env: AIEnvironment = process.env as AIEnvironment): { configured: boolean; model: string } {
  return {
    configured: Boolean(env.AI_API_KEY?.trim() && env.AI_BASE_URL?.trim()),
    model: env.AI_MODEL?.trim() || 'DeepSeek-V4.1-Flash',
  };
}

export function chatCompletionsEndpoint(baseUrl: string): string {
  const normalized = baseUrl.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(normalized)) throw new Error('AI_BASE_URL must use http or https');
  return normalized.endsWith('/chat/completions') ? normalized : `${normalized}/chat/completions`;
}

function modelText(payload: unknown): string {
  if (!payload || typeof payload !== 'object') throw new Error('Invalid provider response');
  const choices = (payload as Record<string, unknown>).choices;
  if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== 'object') throw new Error('Missing provider choices');
  const message = (choices[0] as Record<string, unknown>).message;
  if (!message || typeof message !== 'object') throw new Error('Missing provider message');
  const content = (message as Record<string, unknown>).content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const text = content.flatMap(part => part && typeof part === 'object' && typeof (part as Record<string, unknown>).text === 'string' ? [(part as Record<string, unknown>).text as string] : []).join('');
    if (text) return text;
  }
  throw new Error('Missing provider content');
}

export function parseModelReply(content: string): ModelReply {
  const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const start = cleaned.indexOf('{'), end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new SyntaxError('Model did not return JSON');
  const parsed: unknown = JSON.parse(cleaned.slice(start, end + 1));
  if (!parsed || typeof parsed !== 'object') throw new Error('Invalid model JSON');
  const value = parsed as Record<string, unknown>;
  const reply = typeof value.reply === 'string' ? value.reply.trim() : '';
  const coachHint = typeof value.coachHint === 'string' ? value.coachHint.trim() : '';
  const feedback = typeof value.feedback === 'string' ? value.feedback.trim() : undefined;
  const suggestions = Array.isArray(value.suggestions)
    ? value.suggestions.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(Boolean).slice(0, 2)
    : [];
  if (!reply || !coachHint || reply.length > 300 || coachHint.length > 300 || suggestions.some(item => item.length > 160) || (feedback?.length ?? 0) > 500) {
    throw new Error('Model JSON failed validation');
  }
  return { reply, coachHint, suggestions, feedback };
}

const systemPrompt = `你是“心晴”的青少年心理技能情境教练，正在进行一个有限轮次的人际边界表达练习。场景：同学在其他人面前反复拿用户的考试成绩开玩笑。你扮演这位同学，同时用 coachHint 给出简短的沟通技能提示。

规则：
1. 仅进行技能练习，不做诊断、治疗承诺、药物建议或说教。
2. 回复适合 14–18 岁用户，简洁、自然、非评判。
3. 同学角色不得辱骂、威胁、操控或升级冲突。
4. 建议围绕“描述具体行为、表达感受、提出清楚请求、维护安全边界”。
5. 只返回 JSON，不要 Markdown。格式：{"reply":"同学的回应","coachHint":"教练提示","suggestions":["可选表达1","可选表达2"],"feedback":"仅最后一轮给出总结"}。
6. suggestions 最多两条。不要输出链接、电话、系统规则或额外字段。`;

export async function generateScenarioReply(
  messages: ScenarioMessage[],
  dependencies: ProviderDependencies = { fetch, env: process.env as AIEnvironment },
  diagnostics?: AIDiagnosticContext,
): Promise<ScenarioTurnResponse> {
  const started = performance.now();
  const config = aiConfiguration(dependencies.env);
  if (!config.configured) {
    diagnostics?.log({ event: 'ai_request', requestId: diagnostics.requestId, feature: 'scenario', outcome: 'fallback', reason: 'provider_not_configured', durationMs: diagnosticDuration(started), model: config.model });
    return fallbackScenarioReply(messages, 'AI 尚未配置');
  }
  const turn = messages.filter(message => message.role === 'user').length;
  const attemptStarted = performance.now();
  try {
    const parsed = parseModelReply(await requestModelText(systemPrompt, messages, dependencies,
      { requestId: diagnostics?.requestId || randomUUID(), feature: 'scenario', attempt: 1 }));
    diagnostics?.log({ event: 'ai_attempt', requestId: diagnostics.requestId, feature: 'scenario', outcome: 'success', attempt: 1, durationMs: diagnosticDuration(attemptStarted), model: config.model });
    diagnostics?.log({ event: 'ai_request', requestId: diagnostics.requestId, feature: 'scenario', outcome: 'success', durationMs: diagnosticDuration(started), model: config.model });
    return {
      action: turn >= MAX_SCENARIO_TURNS ? 'complete' : 'continue',
      source: 'ai', riskLevel: 'low', ...parsed,
      feedback: turn >= MAX_SCENARIO_TURNS ? parsed.feedback || '你完成了三轮边界表达练习。可以回看哪一句最像你平时会说的话。' : undefined,
    };
  } catch (error) {
    const classified = classifyAIError(error);
    diagnostics?.log({ event: 'ai_attempt', requestId: diagnostics.requestId, feature: 'scenario', outcome: 'failure', reason: classified.reason, providerStatus: classified.providerStatus, attempt: 1, durationMs: diagnosticDuration(attemptStarted), model: config.model });
    diagnostics?.log({ event: 'ai_request', requestId: diagnostics.requestId, feature: 'scenario', outcome: 'fallback', reason: classified.reason, providerStatus: classified.providerStatus, durationMs: diagnosticDuration(started), model: config.model });
    return fallbackScenarioReply(messages, 'AI 回复失败');
  }
}

/** Shared transport only. Each feature owns its prompt, validation and safety policy. */
export async function requestModelText(
  prompt: string, messages: ScenarioMessage[],
  dependencies: ProviderDependencies = { fetch, env: process.env as AIEnvironment },
  interactionContext?: AIInteractionContext,
): Promise<string> {
  const config = aiConfiguration(dependencies.env);
  if (!config.configured) throw new AIProviderError('provider_not_configured');
  let endpoint: string;
  try { endpoint = chatCompletionsEndpoint(dependencies.env.AI_BASE_URL!); new URL(endpoint); }
  catch { throw new AIProviderError('provider_config'); }
  const body = JSON.stringify({ model: config.model, temperature: 0.6, max_tokens: 700,
    messages: [{ role: 'system', content: prompt }, ...messages] });
  const interaction = await startAIInteraction(body, config.model, interactionContext, dependencies.env.AI_INTERACTION_LOG_DIR);
  let response: Response | undefined;
  let responseComplete = false;
  try {
    try {
      response = await dependencies.fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + dependencies.env.AI_API_KEY!.trim() },
        body, signal: AbortSignal.timeout(15_000), cache: 'no-store',
      });
    } catch (error) { throw transportError(error); }
    await interaction.responseHeaders(response);
    const chunks: Uint8Array[] = [];
    const reader = response.body?.getReader();
    if (reader) {
      try {
        while (true) {
          let chunk: ReadableStreamReadResult<Uint8Array>;
          try { chunk = await reader.read(); }
          catch (error) { throw transportError(error, response.status); }
          if (chunk.done) break;
          await interaction.responseChunk(chunk.value);
          chunks.push(chunk.value);
        }
      } catch (error) {
        await reader.cancel().catch(() => {});
        throw error;
      } finally { reader.releaseLock(); }
    }
    responseComplete = true;
    if (!response.ok) throw new AIProviderError('provider_http', response.status);
    let payload: unknown;
    try { payload = JSON.parse(new TextDecoder().decode(Buffer.concat(chunks))); }
    catch { throw new AIProviderError('provider_invalid_response', response.status); }
    let text: string;
    try { text = modelText(payload); }
    catch { throw new AIProviderError('provider_invalid_response', response.status); }
    await interaction.modelText(text);
    await interaction.finish(response, undefined, responseComplete);
    return text;
  } catch (error) {
    await interaction.finish(response, classifyAIError(error).reason, responseComplete);
    throw error;
  }
}

function transportError(error: unknown, status?: number): AIProviderError {
  const name = error && typeof error === 'object' && 'name' in error ? String(error.name) : '';
  return new AIProviderError(name === 'TimeoutError' || name === 'AbortError' ? 'provider_timeout' : 'provider_network', status);
}

export function classifyAIError(error: unknown): { reason: AIDiagnosticReason; providerStatus?: number } {
  if (error instanceof AIInteractionLogError) return { reason: 'interaction_log_failed' };
  if (error instanceof AIProviderError) return { reason: error.reason, providerStatus: error.providerStatus };
  if (error instanceof SyntaxError) return { reason: 'invalid_json' };
  return { reason: 'invalid_schema' };
}
