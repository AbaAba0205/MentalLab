import { aiConfiguration } from '../server/ai-client.js';

export function GET() {
  const ai = aiConfiguration();
  return Response.json({ status: 'ok', service: 'xinqing', ai: ai.configured ? 'configured' : 'not-configured', model: ai.model, storage: 'server-sqlite' }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
