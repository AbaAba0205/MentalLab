import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3100',
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    trace: 'retain-on-failure',
  },
  webServer: [{
    command: 'node ../scripts/e2e-server.mjs',
    url: 'http://127.0.0.1:4100/api/health',
    reuseExistingServer: false,
    timeout: 60_000,
  }, {
    command: 'npm run build && npm run start -- --port 3100',
    // Test fixtures must not spend tokens or submit synthetic prompts to a real provider.
    env: { SERVER_URL: 'http://127.0.0.1:4100', NEXT_DIST_DIR: '.next-e2e' },
    url: 'http://127.0.0.1:3100/api/health',
    reuseExistingServer: false,
    timeout: 120_000,
  }],
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1050 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
});
