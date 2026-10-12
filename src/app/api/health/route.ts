export function GET() {
  return Response.json({ status: 'ok', service: 'mental-lab', ai: 'not-configured', storage: 'browser-local' }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
