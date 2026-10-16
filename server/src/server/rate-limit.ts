interface RateEntry { count: number; resetAt: number }
const requests = new Map<string, RateEntry>();

export function allowScenarioRequest(key: string, now = Date.now(), limit = 12, windowMs = 60_000): boolean {
  const current = requests.get(key);
  if (!current || current.resetAt <= now) {
    requests.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

export function clearRateLimitsForTests() { requests.clear(); }
