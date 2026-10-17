import { randomUUID } from 'node:crypto';
import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { AIDiagnosticContext, AIDiagnosticReason } from './ai-diagnostics.js';

export class AIInteractionLogError extends Error {
  constructor() { super('interaction_log_failed'); }
}

export interface AIInteractionContext {
  requestId: string;
  feature: AIDiagnosticContext['feature'] | 'unknown';
  attempt: number;
}

/** Bodies live in private files, never in the diagnostic console or Git. */
export async function startAIInteraction(body: string, model: string, context?: AIInteractionContext, directory?: string) {
  const startedAt = new Date().toISOString();
  const interactionId = randomUUID();
  const folder = join(resolve(directory || process.env.AI_INTERACTION_LOG_DIR || './data/ai-interactions'),
    startedAt.slice(0, 10), `${startedAt.replace(/[:.]/g, '-')}-${interactionId}`);
  const metadata = {
    interactionId, requestId: context?.requestId || interactionId, feature: context?.feature || 'unknown',
    attempt: context?.attempt || 1, model, method: 'POST', startedAt,
    state: 'started', responseComplete: false, responseBytes: 0,
  };
  async function persist(operation: () => Promise<unknown>) {
    try { await operation(); }
    catch { throw new AIInteractionLogError(); }
  }
  const writeMetadata = (extra: Record<string, unknown> = {}) => persist(() =>
    writeFile(join(folder, 'metadata.json'), JSON.stringify({ ...metadata, ...extra }, null, 2), { mode: 0o600 }));
  // Persist the exact string passed to fetch before making the external call.
  await persist(async () => {
    await mkdir(folder, { recursive: true, mode: 0o700 });
    await writeFile(join(folder, 'request.json'), body, { flag: 'wx', mode: 0o600 });
    await writeFile(join(folder, 'response.txt'), '', { flag: 'wx', mode: 0o600 });
  });
  await writeMetadata();
  return {
    async responseHeaders(response: Response) {
      await writeMetadata({ providerStatus: response.status, contentType: response.headers.get('content-type') });
    },
    async responseChunk(chunk: Uint8Array) {
      await persist(() => appendFile(join(folder, 'response.txt'), chunk));
      metadata.responseBytes += chunk.byteLength;
    },
    async modelText(text: string) {
      await persist(() => writeFile(join(folder, 'model-content.txt'), text, { mode: 0o600 }));
    },
    async finish(response?: Response, reason?: AIDiagnosticReason, responseComplete = false) {
      await writeMetadata({ state: reason ? 'failure' : 'response_received', completedAt: new Date().toISOString(),
        providerStatus: response?.status, contentType: response?.headers.get('content-type'), responseComplete, reason });
    },
  };
}
