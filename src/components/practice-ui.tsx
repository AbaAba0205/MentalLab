'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { moods } from '@/lib/model';

export function Modal({ title, label, children, actions, onClose, dismissible = true }: {
  title: string; label: string; children: ReactNode; actions?: ReactNode; onClose: () => void; dismissible?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return <dialog id="dialog" ref={ref} aria-labelledby="dialog-title" onCancel={event => { if (!dismissible) event.preventDefault(); else onClose(); }}>
    <div className="modal">
      <div className="modal-top"><span className="modal-label">{label}</span>{dismissible && <button className="close-button" aria-label="关闭" onClick={onClose}>×</button>}</div>
      <h2 id="dialog-title">{title}</h2>{children}
      {actions && <div className="modal-actions">{actions}</div>}
    </div>
  </dialog>;
}

export function MoodButtons({ selected = '', onSelect }: { selected?: string; onSelect: (id: string) => void }) {
  return <div className="moods">{moods.map(m => <button key={m.id} className={`mood ${selected === m.id ? 'selected' : ''}`} data-mood={m.id} aria-pressed={selected === m.id} onClick={() => onSelect(m.id)}>
    <span className="face" style={{ '--face': m.color } as CSSProperties}>{m.face}</span>{m.label}
  </button>)}</div>;
}

export function Intensity({ value, onChange, label = '此刻的困扰有多强烈？' }: { value: number; onChange: (n: number) => void; label?: string }) {
  return <>
    <label className="range-label" htmlFor="intensity">{label}<strong id="intensity-value">{value} <small>/ 10</small></strong></label>
    <input id="intensity" type="range" min="0" max="10" value={value} onChange={e => onChange(Number(e.target.value))} />
    <div className="range-ends"><span>0 · 没有困扰</span><span>10 · 很难承受</span></div>
  </>;
}

export function PracticeTimer() {
  const [remaining, setRemaining] = useState(30);
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);
  const deadline = useRef(0);
  useEffect(() => {
    if (!running) return;
    const interval = window.setInterval(() => {
      const seconds = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
      setRemaining(seconds);
      if (seconds === 0) setRunning(false);
    }, 100);
    return () => window.clearInterval(interval);
  }, [running]);
  function toggle() {
    if (running) { setRunning(false); return; }
    const seconds = remaining || 30;
    setRemaining(seconds);
    deadline.current = Date.now() + seconds * 1000;
    setStarted(true);
    setRunning(true);
  }
  return <>
    <div className="timer-ring"><strong id="timer-value">00:{String(remaining).padStart(2, '0')}</strong><small>给自己一点时间</small></div>
    <div className="timer-controls">
      <button className="secondary" onClick={toggle}>{running ? '暂停计时' : remaining === 0 ? '再来一次' : started ? '继续计时' : '开始计时'}</button>
      <button className="text-button" onClick={() => { setRunning(false); setStarted(false); setRemaining(30); }}>重置</button>
    </div>
  </>;
}
