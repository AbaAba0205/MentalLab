import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = mkdtempSync(join(tmpdir(), 'xinqing-e2e-'));
const cwd = fileURLToPath(new URL('../server', import.meta.url));
const env = { ...process.env, DATABASE_PATH: join(directory, 'e2e.sqlite'), PORT: '4000', HOST: '127.0.0.1', CLIENT_ORIGINS: 'http://127.0.0.1:3100', COOKIE_SECURE: 'false', AUTH_IP_LIMIT: '1000', AI_API_KEY: '', AI_BASE_URL: '', AI_MODEL: 'DeepSeek-V4.1-Flash', ADMIN_EMAIL: 'admin@e2e.test', ADMIN_PASSWORD: 'Admin-password-2026' };
const seed = spawn(process.execPath, ['--import', 'tsx', 'src/create-admin.ts'], { cwd, env, stdio: 'inherit' });
seed.on('exit', code => {
  if (code) { process.exitCode = code; return; }
  const child = spawn(process.execPath, ['dist/index.js'], { cwd, env, stdio: 'inherit' });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill());
  child.on('exit', code => { process.exitCode = code || 0; });
});
