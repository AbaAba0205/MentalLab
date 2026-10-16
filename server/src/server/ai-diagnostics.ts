import { randomUUID } from 'node:crypto';

export type AIDiagnosticReason =
  | 'provider_not_configured' | 'provider_config' | 'provider_timeout' | 'provider_network'
  | 'provider_http' | 'provider_invalid_response' | 'invalid_json' | 'invalid_schema'
  | 'response_too_long' | 'unsafe_text' | 'ineligible_exercise' | 'model_safety_handoff'
  | 'local_safety_handoff' | 'rate_limited' | 'fallback'
  | 'authentication_required' | 'request_forbidden' | 'invalid_request' | 'internal_error';

export type AIDiagnosticEvent = {
  event: 'ai_http' | 'ai_request' | 'ai_attempt';
  requestId: string;
  feature: 'chat' | 'scenario';
  outcome: 'started' | 'success' | 'failure' | 'fallback' | 'handoff' | 'rejected';
  durationMs: number;
  attempt?: number;
  reason?: AIDiagnosticReason;
  providerStatus?: number;
  responseStatus?: number;
  model?: string;
};

export type AIDiagnosticLogger = (event: AIDiagnosticEvent) => void;
export type AIDiagnosticContext = { requestId: string; feature: 'chat' | 'scenario'; log: AIDiagnosticLogger };

export function writeAIDiagnostic(event: AIDiagnosticEvent) {
  // Explicit fields prevent accidental additions of request bodies, headers or errors.
  const { requestId, feature, outcome, durationMs, attempt, reason, providerStatus, responseStatus, model } = event;
  console.info(JSON.stringify({ timestamp: new Date().toISOString(), component: 'xinqing-ai', event: event.event,
    requestId, feature, outcome, durationMs, attempt, reason, providerStatus, responseStatus, model }));
}

export function aiDiagnosticContext(feature: AIDiagnosticContext['feature'], requestId: string = randomUUID(), log: AIDiagnosticLogger = writeAIDiagnostic): AIDiagnosticContext {
  // Diagnostics must never turn a valid reply into a retry or fallback.
  return { feature, requestId, log: event => { try { log(event); } catch { /* Keep serving the request if the log sink fails. */ } } };
}

export function diagnosticDuration(started: number) {
  return Math.max(0, Math.round(performance.now() - started));
}
