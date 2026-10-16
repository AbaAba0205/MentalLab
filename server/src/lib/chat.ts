import { assessRisk } from './safety.js';
import { getExercise, isExerciseId, type ExerciseId } from './training/registry.js';

export interface ChatMessage { role: 'user' | 'assistant'; content: string }
export interface ChatReply {
  action: 'reply' | 'handoff';
  source: 'ai' | 'fallback' | 'safety';
  reply: string;
  exerciseId: ExerciseId | null;
}
export const MAX_CHAT_MESSAGES = 21;
export const CHAT_GREETING = '我是心晴的 AI 心理陪伴导师。你可以说说今天的小事，也可以只说一句“有点累”。不想做练习也没关系，我们可以先聊聊。';
export function supportReply(): ChatReply {
  return { action: 'handoff', source: 'safety', exerciseId: null,
    reply: '谢谢你告诉我这些。你不需要独自承受，我们先把练习放一放。你现在是否安全？如果有正在发生的危险，请尽快联系身边安全、可信任的人或当地紧急服务。下方可以查看现实支持。' };
}
export function chatNeedsSupport(messages: ChatMessage[]): boolean {
  return messages.some(message => message.role === 'user' && assessRisk(message.content).requiresHandoff);
}
export function parseChatRequest(input: unknown): ChatMessage[] | null {
  if (!input || typeof input !== 'object' || !('messages' in input) || !Array.isArray(input.messages)) return null;
  if (!input.messages.length || input.messages.length > MAX_CHAT_MESSAGES || input.messages.length % 2 !== 1) return null;
  const messages: ChatMessage[] = [];
  let total = 0;
  for (const [index, message] of input.messages.entries()) {
    if (!message || typeof message !== 'object' || message.role !== (index % 2 === 0 ? 'user' : 'assistant') || typeof message.content !== 'string') return null;
    const content = message.content.trim();
    if (!content || content.length > (message.role === 'user' ? 1000 : 800)) return null;
    total += content.length;
    messages.push({ role: message.role, content });
  }
  return total <= 14000 ? messages : null;
}
/** Keep complete pairs while respecting the server's total character budget. */
export function boundedChatContext(messages: ChatMessage[]): ChatMessage[] {
  const context = messages.slice(-MAX_CHAT_MESSAGES);
  let length = context.reduce((sum, message) => sum + message.content.length, 0);
  while (context.length > 1 && length > 14000) {
    length -= context[0].content.length + context[1].content.length;
    context.splice(0, 2);
  }
  return context;
}
export function isChatReply(value: unknown): value is ChatReply {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return ['reply', 'handoff'].includes(String(item.action)) && ['ai', 'fallback', 'safety'].includes(String(item.source))
    && typeof item.reply === 'string' && item.reply.trim().length > 0 && item.reply.length <= 800
    && (item.exerciseId === null || isExerciseId(item.exerciseId))
    && (item.action !== 'handoff' || (item.exerciseId === null && item.source === 'safety'))
    && (item.source !== 'safety' || item.action === 'handoff');
}

export function trainingPolicy(messages: ChatMessage[]) {
  const users = messages.filter(message => message.role === 'user').map(message => message.content);
  const latest = users.at(-1) || '';
  // Remember the most recent explicit preference within the submitted context.
  let declined = false;
  let intensity: number | null = null;
  for (const text of users) {
    if (/不(?:想|要|用).{0,8}(?:练习|训练|建议)|只想.{0,6}(?:聊|说|倾诉)|别.{0,4}(?:推荐|练习)/.test(text)) declined = true;
    else if (/想试|愿意.{0,6}(?:试|练)|(?:想|要|带我|推荐).{0,8}(?:练习|训练)/.test(text)) declined = false;
    const match = text.match(/(?:强度|困扰|焦虑|情绪|难受)(?:程度)?(?:现在|是|大概|大约|只有|有|为|：|:|\s)*(10|[0-9])(?:\s*(?:分|[/／]\s*10))/);
    if (match) intensity = Number(match[1]);
  }
  const overwhelmed = /喘不过气|崩溃|慌得|特别慌|非常慌|情绪很强|无法冷静/.test(latest) || (intensity !== null && intensity >= 4);
  return { declined, intensity, overwhelmed };
}
export function allowedTraining(id: unknown, messages: ChatMessage[]): ExerciseId | null {
  if (!isExerciseId(id) || chatNeedsSupport(messages)) return null;
  const policy = trainingPolicy(messages);
  if (policy.declined) return null;
  // Only grounding is offered without an explicit, low self-rated intensity.
  const maximum = getExercise(id).maxIntensity;
  if (maximum !== undefined && (policy.overwhelmed || policy.intensity === null || policy.intensity > maximum)) return null;
  return id;
}
export function fallbackChatReply(messages: ChatMessage[]): ChatReply {
  if (chatNeedsSupport(messages)) return supportReply();
  const latest = messages.at(-1)?.content || '';
  const policy = trainingPolicy(messages);
  let reply = '你可以按自己的节奏说，不用一次讲清楚。此刻最想让我了解的是哪一件事？';
  let exerciseId: ExerciseId | null = null;
  if (policy.declined) reply = '好，我们先聊，不安排练习。你希望我先听你说哪一部分？';
  else if (policy.overwhelmed || /(?:想|推荐|带我|做个|试试).{0,8}(?:练习|训练)|稳一稳/.test(latest)) {
    exerciseId = allowedTraining('ground', messages);
    reply = '我们可以先慢一点，不急着分析或解决。如果你愿意，可以试试下面的小练习；也可以跳过，继续说说此刻的感受。';
  } else if (/考试|担心|紧张|焦虑/.test(latest)) reply = '这件事似乎让你挂心。我们不用急着说服自己不紧张；你愿意说说最担心的是哪一部分吗？';
  else if (/孤单|孤独|难过|低落/.test(latest)) reply = '谢谢你愿意说起这些感受。你不需要马上振作起来；最近有什么时刻让这种感觉特别明显吗？';
  return { action: 'reply', source: 'fallback', reply, exerciseId };
}
