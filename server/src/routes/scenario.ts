import { clientKey, sameOrigin } from '../server/request-guards.js';
import { parseScenarioRequest, safetyScenarioReply, scenarioRisk } from '../lib/scenario.js';
import { generateScenarioReply } from '../server/ai-client.js';
import { allowScenarioRequest } from '../server/rate-limit.js';
import { aiDiagnosticContext, diagnosticDuration } from '../server/ai-diagnostics.js';

export const runtime = 'nodejs';

export async function POST(request: Request, diagnostics = aiDiagnosticContext('scenario')) {
  const started = performance.now();
  const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Request-Id': diagnostics.requestId } });
  if (!sameOrigin(request)) return json({ error: '不允许跨站调用' }, 403);
  if (!allowScenarioRequest(clientKey(request))) {
    diagnostics.log({ event: 'ai_request', requestId: diagnostics.requestId, feature: 'scenario', outcome: 'rejected', reason: 'rate_limited', durationMs: diagnosticDuration(started) });
    return json({ error: '请求过于频繁，请稍后再试' }, 429);
  }
  let input: unknown;
  try { input = await request.json(); }
  catch { return json({ error: '请求内容不是有效 JSON' }, 400); }
  const parsed = parseScenarioRequest(input);
  if (!parsed.ok) return json({ error: parsed.error }, 400);
  const risk = scenarioRisk(parsed.value.messages);
  if (risk.requiresHandoff) diagnostics.log({ event: 'ai_request', requestId: diagnostics.requestId, feature: 'scenario', outcome: 'handoff', reason: 'local_safety_handoff', durationMs: diagnosticDuration(started) });
  const result = risk.requiresHandoff
    ? safetyScenarioReply(risk.level as 'medium' | 'high' | 'imminent')
    : await generateScenarioReply(parsed.value.messages, undefined, diagnostics);
  return json(result);
}
