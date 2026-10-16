import { assessRisk, type RiskLevel } from './safety';

export const SCENARIO_ID = 'peer-boundary' as const;
export const MAX_SCENARIO_TURNS = 3;

export interface ScenarioMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ScenarioTurnRequest {
  scenarioId: typeof SCENARIO_ID;
  messages: ScenarioMessage[];
}

export interface ScenarioTurnResponse {
  action: 'continue' | 'complete' | 'handoff';
  source: 'ai' | 'fallback' | 'safety';
  reply: string;
  coachHint: string;
  suggestions: string[];
  feedback?: string;
  riskLevel: RiskLevel;
}

export type ScenarioValidation =
  | { ok: true; value: ScenarioTurnRequest }
  | { ok: false; error: string };

export function isScenarioTurnResponse(value: unknown): value is ScenarioTurnResponse {
  if (!value || typeof value !== 'object') return false;
  const response = value as Record<string, unknown>;
  return ['continue', 'complete', 'handoff'].includes(String(response.action))
    && ['ai', 'fallback', 'safety'].includes(String(response.source))
    && ['low', 'medium', 'high', 'imminent'].includes(String(response.riskLevel))
    && typeof response.reply === 'string' && response.reply.length <= 600
    && typeof response.coachHint === 'string' && response.coachHint.length <= 600
    && Array.isArray(response.suggestions)
    && response.suggestions.length <= 2
    && response.suggestions.every(item => typeof item === 'string' && item.length <= 200)
    && (response.feedback === undefined || (typeof response.feedback === 'string' && response.feedback.length <= 600));
}

export function parseScenarioRequest(input: unknown): ScenarioValidation {
  if (!input || typeof input !== 'object') return { ok: false, error: '请求内容格式不正确' };
  const raw = input as Record<string, unknown>;
  if (raw.scenarioId !== SCENARIO_ID) return { ok: false, error: '不支持的练习场景' };
  if (!Array.isArray(raw.messages) || raw.messages.length < 1 || raw.messages.length > MAX_SCENARIO_TURNS * 2) {
    return { ok: false, error: '对话轮次不正确' };
  }
  const messages: ScenarioMessage[] = [];
  let userCount = 0;
  let totalLength = 0;
  for (const item of raw.messages) {
    if (!item || typeof item !== 'object') return { ok: false, error: '对话内容格式不正确' };
    const message = item as Record<string, unknown>;
    if ((message.role !== 'user' && message.role !== 'assistant') || typeof message.content !== 'string') {
      return { ok: false, error: '对话内容格式不正确' };
    }
    const content = message.content.trim();
    if (!content || content.length > 500) return { ok: false, error: '每条消息需为 1 到 500 个字符' };
    if (message.role === 'user') userCount += 1;
    totalLength += content.length;
    messages.push({ role: message.role, content });
  }
  if (userCount < 1 || userCount > MAX_SCENARIO_TURNS || totalLength > 2500 || messages.at(-1)?.role !== 'user') {
    return { ok: false, error: '对话顺序或长度不正确' };
  }
  return { ok: true, value: { scenarioId: SCENARIO_ID, messages } };
}

export function scenarioRisk(messages: ScenarioMessage[]) {
  return assessRisk(messages.filter(message => message.role === 'user').map(message => message.content).join('\n'));
}

export function fallbackScenarioReply(messages: ScenarioMessage[], reason = 'AI 暂时不可用'): ScenarioTurnResponse {
  const turn = messages.filter(message => message.role === 'user').length;
  const scripts = [
    {
      reply: '我只是开个玩笑，你怎么这么认真？',
      coachHint: '可以先描述发生了什么，再说出你的感受和希望。',
      suggestions: ['你拿我的成绩开玩笑时，我会不舒服，请不要再这样说。', '我知道你可能在开玩笑，但我不喜欢这样，请停下来。'],
    },
    {
      reply: '好吧，那你希望我以后怎么做？',
      coachHint: '把希望说具体，也可以给对方一个可执行的替代方式。',
      suggestions: ['不要再评论我的成绩，我们可以聊点别的。', '如果你想问我的成绩，可以私下问，不要在大家面前说。'],
    },
    {
      reply: '我明白了，以后我会注意。',
      coachHint: '你已经清楚表达了边界。现实中可以按自己的安全感决定是否继续沟通。',
      suggestions: [],
    },
  ];
  const script = scripts[Math.min(turn - 1, scripts.length - 1)];
  return {
    action: turn >= MAX_SCENARIO_TURNS ? 'complete' : 'continue',
    source: 'fallback',
    reply: script.reply,
    coachHint: `${reason}，当前使用预设情境。${script.coachHint}`,
    suggestions: script.suggestions,
    feedback: turn >= MAX_SCENARIO_TURNS ? '你说明了具体行为、自己的感受和希望对方如何调整。表达边界时，清楚和具体通常比反复解释更有帮助。' : undefined,
    riskLevel: 'low',
  };
}

export function safetyScenarioReply(level: Exclude<RiskLevel, 'low'>): ScenarioTurnResponse {
  return {
    action: 'handoff', source: 'safety', riskLevel: level,
    reply: '我们先暂停这个情境练习。现在最重要的是确认你的现实安全，并联系能够陪在你身边的人。',
    coachHint: '普通训练已停止，请进入现实支持页面。', suggestions: [],
  };
}
