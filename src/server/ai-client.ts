import { fallbackScenarioReply, MAX_SCENARIO_TURNS, type ScenarioMessage, type ScenarioTurnResponse } from '@/lib/scenario';

export interface AIEnvironment {
  AI_API_KEY?: string;
  AI_BASE_URL?: string;
  AI_MODEL?: string;
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

export function aiConfiguration(env: AIEnvironment = process.env as AIEnvironment): { configured: boolean; model: string } {
  return {
    configured: Boolean(env.AI_API_KEY?.trim() && env.AI_BASE_URL?.trim()),
    model: env.AI_MODEL?.trim() || 'Qwen3.5-27B',
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
  if (start < 0 || end <= start) throw new Error('Model did not return JSON');
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

const systemPrompt = `你是“心屿”的青少年心理技能情境教练，正在进行一个有限轮次的人际边界表达练习。场景：同学在其他人面前反复拿用户的考试成绩开玩笑。你扮演这位同学，同时用 coachHint 给出简短的沟通技能提示。

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
): Promise<ScenarioTurnResponse> {
  const config = aiConfiguration(dependencies.env);
  if (!config.configured) return fallbackScenarioReply(messages, 'AI 尚未配置');
  const turn = messages.filter(message => message.role === 'user').length;
  try {
    const parsed = parseModelReply(await requestModelText(systemPrompt, messages, dependencies));
    return {
      action: turn >= MAX_SCENARIO_TURNS ? 'complete' : 'continue',
      source: 'ai', riskLevel: 'low', ...parsed,
      feedback: turn >= MAX_SCENARIO_TURNS ? parsed.feedback || '你完成了三轮边界表达练习。可以回看哪一句最像你平时会说的话。' : undefined,
    };
  } catch {
    return fallbackScenarioReply(messages, 'AI 回复失败');
  }
}

/** Shared transport only. Each feature owns its prompt, validation and safety policy. */
export async function requestModelText(
  prompt: string, messages: ScenarioMessage[],
  dependencies: ProviderDependencies = { fetch, env: process.env as AIEnvironment },
): Promise<string> {
  const config = aiConfiguration(dependencies.env);
  if (!config.configured) throw new Error('AI is not configured');
  const qwenThinkingOptions = /^qwen3(?:\.5)?(?:[-_]|$)/i.test(config.model)
    ? { chat_template_kwargs: { enable_thinking: false } } : {};
  const response = await dependencies.fetch(chatCompletionsEndpoint(dependencies.env.AI_BASE_URL!), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + dependencies.env.AI_API_KEY!.trim() },
    body: JSON.stringify({ model: config.model, temperature: 0.6, max_tokens: 700,
      messages: [{ role: 'system', content: prompt }, ...messages], ...qwenThinkingOptions }),
    signal: AbortSignal.timeout(15_000), cache: 'no-store',
  });
  if (!response.ok) throw new Error('Provider unavailable');
  return modelText(await response.json());
}
