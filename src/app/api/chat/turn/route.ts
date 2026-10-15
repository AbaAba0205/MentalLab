import { parseChatRequest, chatNeedsSupport, supportReply } from '@/lib/chat';
import { generateChatReply } from '@/server/chat-agent';
import { allowScenarioRequest } from '@/server/rate-limit';
import { clientKey, sameOrigin } from '@/server/request-guards';

export const runtime = 'nodejs';
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

async function boundedBody(request: Request): Promise<unknown> {
  if (!request.body) throw new Error('No body');
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0, text = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 64000) { await reader.cancel(); throw new Error('Body too large'); }
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally { reader.releaseLock(); }
}
export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: '不允许跨站调用' }, 403);
  let input: unknown;
  try { input = await boundedBody(request); }
  catch { return json({ error: '消息格式不正确或内容过长' }, 400); }
  const messages = parseChatRequest(input);
  if (!messages) return json({ error: '请发送有效的对话，每条文字不超过 1000 字' }, 400);
  // Safety responses remain available even after the model-call budget is exhausted.
  if (chatNeedsSupport(messages)) return json(supportReply());
  if (!allowScenarioRequest('chat:' + clientKey(request))) return json({ error: '消息发得有些快，请稍后再试。需要现实支持时可打开帮助。' }, 429);
  return json(await generateChatReply(messages));
}
