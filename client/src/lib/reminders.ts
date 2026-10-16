export interface ReminderConfig {
  intervalSeconds: number;
  messages: string[];
}

export function parseReminderConfig(value: unknown): ReminderConfig | null {
  if (!value || typeof value !== 'object') return null;
  const config = value as Record<string, unknown>;
  if (typeof config.intervalSeconds !== 'number' || !Number.isInteger(config.intervalSeconds)
    || config.intervalSeconds < 5 || config.intervalSeconds > 3600 || !Array.isArray(config.messages)) return null;
  const messages = config.messages.filter((message): message is string => typeof message === 'string')
    .map(message => message.trim()).filter(message => message.length > 0 && message.length <= 120);
  return messages.length ? { intervalSeconds: config.intervalSeconds, messages } : null;
}
