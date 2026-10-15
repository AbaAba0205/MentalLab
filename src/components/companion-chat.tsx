'use client';

import { useEffect, useRef, useState } from 'react';
import { CHAT_GREETING, boundedChatContext, trainingPolicy, chatNeedsSupport, isChatReply, supportReply, type ChatMessage, type ChatReply } from '@/lib/chat';
import { getExercise } from '@/lib/training/registry';
import type { PracticeRecord } from '@/lib/model';
import { TrainingSession } from './training-session';
import { Icon } from './icon';

type Entry = ChatMessage & { result?: ChatReply; trainingState?: 'skipped' | 'saved' };
export function CompanionChat({ active, onHandoff, onSave }: {
  active: boolean; onHandoff: () => void; onSave: (record: PracticeRecord) => boolean;
}) {
  const [messages, setMessages] = useState<Entry[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [handoff, setHandoff] = useState(false);
  const [trainingIndex, setTrainingIndex] = useState<number | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const requestGeneration = useRef(0);
  const log = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (active && log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [active, messages, loading]);

  function cancelPending() {
    requestGeneration.current++;
    controller.current?.abort();
    busy.current = false; setLoading(false); setError('');
  }
  function receive(content: string, response: ChatReply) {
    setMessages(previous => [...previous, { role: 'user', content }, { role: 'assistant', content: response.reply, result: response }]);
    setInput('');
    if (response.action === 'handoff') { setHandoff(true); setTrainingIndex(null); }
  }
  async function send() {
    const content = input.trim();
    if (!content || busy.current || handoff) return;
    const context = [...messages.map(({ role, content }) => ({ role, content })), { role: 'user' as const, content }];
    if (chatNeedsSupport(context)) { receive(content, supportReply()); return; }
    const generation = ++requestGeneration.current;
    busy.current = true; setLoading(true); setError('');
    const abort = new AbortController(); controller.current = abort;
    const timeout = window.setTimeout(() => abort.abort(), 22_000);
    try {
      const response = await fetch('/api/chat/turn', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: boundedChatContext(context) }), signal: abort.signal });
      const result: unknown = await response.json();
      if (!response.ok || !isChatReply(result)) throw new Error('Chat request failed');
      if (generation === requestGeneration.current) receive(content, result);
    } catch {
      if (generation === requestGeneration.current) setError('这条消息暂时没有收到回应，你写的内容还在。可以稍后重试，也可以先休息一下。');
    } finally { window.clearTimeout(timeout); if (generation === requestGeneration.current) { busy.current = false; setLoading(false); } }
  }
  function skip(index: number) {
    setMessages(previous => [...previous.map((message, i) => i === index ? { ...message, trainingState: 'skipped' as const } : message),
      { role: 'user', content: '暂时不想做练习，只想聊聊。' },
      { role: 'assistant', content: '好，我们先聊，不安排练习。你可以按自己的节奏说。' }]);
    setTrainingIndex(null);
    textarea.current?.focus();
  }
  function trainingHandoff() {
    cancelPending();
    setHandoff(true); setTrainingIndex(null);
    const result = supportReply();
    // This local support entry is never submitted: ordinary chat is now paused.
    setMessages(previous => [...previous, { role: 'assistant', content: result.reply, result }]);
  }
  return <section className="companion" aria-label="随心聊">
    <div className="companion-top"><div className="companion-identity"><span className="companion-avatar"><Icon name="leaf" /></span><div><strong>心屿陪伴导师</strong><span>AI 陪伴 · 按你的节奏来</span></div></div>
      <button className="text-button" disabled={loading || !messages.length} onClick={() => setConfirmClear(true)}>清空对话</button></div>
    <div className="chat-log" ref={log} role="log" aria-label="聊天记录" aria-live="polite" aria-relevant="additions text">
      <div className="chat-message assistant"><span className="chat-author">心屿</span><p>{CHAT_GREETING}</p></div>
      {messages.map((message, index) => {
        const exercise = message.result?.exerciseId ? getExercise(message.result.exerciseId) : null;
        return <div key={index} className={'chat-message ' + message.role}>
          <span className="chat-author">{message.role === 'user' ? '我' : '心屿'}{message.result && <span className="chat-source">{message.result.source === 'ai' ? 'AI 回应' : message.result.source === 'safety' ? '现实支持' : '预设回应 · AI 暂时不可用'}</span>}</span><p>{message.content}</p>
          {exercise && !handoff && <div className="chat-training-card">
            <span className="training-kicker">可选的小训练 · {exercise.time}</span><h3>{exercise.title}</h3><p>{exercise.description}</p>
            {message.trainingState ? <p className="training-status">{message.trainingState === 'saved' ? '已完成，本次练习可在“我的记录”查看。' : '已跳过，我们按你的节奏聊。'}</p>
              : trainingIndex === index ? <TrainingSession key={index} exerciseId={exercise.id} initialIntensity={trainingPolicy(messages).intensity ?? 5} inline onClose={() => setTrainingIndex(null)} onHandoff={trainingHandoff} onSave={record => {
                const saved = onSave(record);
                // The runner reports storage failures itself; do not claim a durable save here.
                if (saved) { setMessages(previous => previous.map((entry, i) => i === index ? { ...entry, trainingState: 'saved' } : entry)); setTrainingIndex(null); }
                return saved;
              }} />
              : <div className="chat-card-actions"><button className="primary" disabled={loading || trainingIndex !== null} onClick={() => setTrainingIndex(index)}>开始小训练</button><button className="secondary" disabled={loading || trainingIndex !== null} onClick={() => skip(index)}>暂时不练，继续聊</button></div>}
          </div>}
        </div>;
      })}
      {loading && <div className="chat-message user pending"><span className="chat-author">我 · 发送中</span><p>{input}</p></div>}
      {loading && <p className="chat-loading" role="status">正在认真读你说的话…</p>}
    </div>
    {handoff && <div className="chat-support" role="status"><strong>先照顾现实中的安全</strong><p>这段普通聊天和训练已暂停。若有紧急危险，中国大陆可联系 110 或 120；其他地区请联系当地紧急服务。可以找安全、可信任的人陪着你。</p><button className="primary" onClick={onHandoff}>查看现实支持</button></div>}
    {!messages.length && <div className="chat-starters" aria-label="聊天话题">{['今天有点累，想聊聊', '想到考试，我有些紧张', '我想试一个小练习'].map(text => <button key={text} onClick={() => { setInput(text); textarea.current?.focus(); }}>{text}</button>)}</div>}
    <form className="chat-composer" onSubmit={event => { event.preventDefault(); void send(); }}>
      <label htmlFor="chat-input">想说什么，都可以慢慢来</label><textarea ref={textarea} id="chat-input" maxLength={1000} disabled={loading || handoff} value={input} onChange={event => setInput(event.target.value)} placeholder={handoff ? '先联系现实中的支持，让安全、可信任的人陪着你。' : '从今天的一件小事开始…'} onKeyDown={event => {
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); }
      }} />
      <div className="composer-footer"><span>{input.length} / 1000 · Ctrl / ⌘ + Enter 发送</span><button type="submit" className="primary" disabled={!input.trim() || loading || handoff}>{loading ? '正在回应…' : error ? '重试发送' : '发送消息 ↗'}</button></div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </form>
    <p className="chat-privacy">对话仅在当前页面保留，刷新后消失。发送时会将文字及最多最近 10 轮对话交给模型服务。AI 可能理解不准确，不提供诊断或治疗。</p>
    {confirmClear && <div className="chat-clear" role="group" aria-label="确认清空对话"><p>清空当前对话并重新开始？练习记录会保留在“我的记录”中。清空并不代表安全问题已解决。</p><button className="secondary" onClick={() => setConfirmClear(false)}>保留对话</button><button className="primary" onClick={() => { cancelPending(); setMessages([]); setInput(''); setError(''); setHandoff(false); setTrainingIndex(null); setConfirmClear(false); }}>确认清空对话</button></div>}
  </section>;
}
