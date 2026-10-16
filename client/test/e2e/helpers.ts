import { randomUUID } from 'node:crypto';
import { expect, type Page } from '@playwright/test';

export async function createAccount(page: Page) {
  const email = `${randomUUID()}@e2e.test`, password = 'Test-password-2026';
  const response = await page.request.post('/api/auth/register', { data: { email, name: '测试小岛', password } });
  expect(response.status()).toBe(201);
  return { email, password, user: (await response.json()).user };
}
