import { clientKey, sameOrigin } from '@/server/request-guards';
import { parseScenarioRequest, safetyScenarioReply, scenarioRisk } from '@/lib/scenario';
import { generateScenarioReply } from '@/server/ai-client';
import { allowScenarioRequest } from '@/server/rate-limit';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: '不允许跨站调用' }, { status: 403 });
  if (!allowScenarioRequest(clientKey(request))) return Response.json({ error: '请求过于频繁，请稍后再试' }, { status: 429 });
  let input: unknown;
  try { input = await request.json(); }
  catch { return Response.json({ error: '请求内容不是有效 JSON' }, { status: 400 }); }
  const parsed = parseScenarioRequest(input);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  const risk = scenarioRisk(parsed.value.messages);
  const result = risk.requiresHandoff
    ? safetyScenarioReply(risk.level as 'medium' | 'high' | 'imminent')
    : await generateScenarioReply(parsed.value.messages);
  return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
}
