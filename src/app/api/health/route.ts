import { aiConfiguration } from '@/server/ai-client';

export function GET() {
  const ai = aiConfiguration();
  return Response.json({ status: 'ok', service: 'mental-lab', ai: ai.configured ? 'configured' : 'not-configured', model: ai.model, storage: 'browser-local' }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
