import test from 'node:test';
import assert from 'node:assert/strict';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import { blockCrossSiteDEV } from 'next/dist/server/lib/router-utils/block-cross-site-dev.js';
import config from '../next.config';

function checkDevOrigin(origin: string) {
  const request = new IncomingMessage(new Socket());
  request.url = '/_next/hmr?id=origin-regression';
  request.headers = { origin };
  const response = new ServerResponse(request);
  try {
    return {
      blocked: blockCrossSiteDEV(request, response, config.allowedDevOrigins, '0.0.0.0'),
      status: response.statusCode,
    };
  } finally {
    response.destroy();
    request.destroy();
  }
}

test('the public FRP origin can connect to development HMR over HTTPS', () => {
  assert.equal(checkDevOrigin('https://frp-off.com:58801').blocked, false);
});

test('localhost development HMR remains available', () => {
  assert.equal(checkDevOrigin('http://localhost:3000').blocked, false);
});

test('unrelated domains and FRP subdomains remain blocked', () => {
  for (const origin of ['https://untrusted.example', 'https://untrusted.frp-off.com:58801', 'https://frp-off.com.untrusted.example']) {
    assert.deepEqual(checkDevOrigin(origin), { blocked: true, status: 403 });
  }
});
