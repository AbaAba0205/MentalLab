'use client';

import { useEffect, useState } from 'react';
import { parseReminderConfig, type ReminderConfig } from '@/lib/reminders';

export function SidebarReminder() {
  const [config, setConfig] = useState<ReminderConfig | null>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/config/reminders.json', { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (!response.ok) return;
        const parsed = parseReminderConfig(await response.json());
        if (!controller.signal.aborted) setConfig(parsed);
      }).catch(() => { /* An unavailable configuration simply hides the reminder. */ });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!config || config.messages.length < 2) return;
    const interval = window.setInterval(() => setIndex(previous => (previous + 1) % config.messages.length), config.intervalSeconds * 1000);
    return () => window.clearInterval(interval);
  }, [config]);

  if (!config) return null;
  return <>
    <div className="sidebar-divider" /><p className="sidebar-label" id="reminder-heading">给自己的小提醒</p>
    <section className="sidebar-note" aria-labelledby="reminder-heading">
      <span className="note-spark" aria-hidden="true">✧</span><p>{config.messages[index]}</p>
      <div className="note-hills" aria-hidden="true"><span /><i /><b>✿</b></div>
    </section>
  </>;
}
