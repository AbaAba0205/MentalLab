'use client';

import { useState } from 'react';
import { isScenarioTurnResponse, SCENARIO_ID, type ScenarioMessage, type ScenarioTurnResponse } from '@/lib/scenario';
import { needsSupport } from '@/lib/model';
import { Modal } from './practice-ui';

const opening: ScenarioMessage = { role: 'assistant', content: '你最近是不是退步了？我只是跟大家开个玩笑而已。' };

export function ScenarioPractice({ onClose, onComplete, onHandoff }: {
  onClose: () => void;
  onComplete: (summary: string) => void;
  onHandoff: () => void;
}) {
  const [started, setStarted] = useState(false);
  const [messages, setMessages] = useState<ScenarioMessage[]>([opening]);
  const [input, setInput] = useState('');
  const [response, setResponse] = useState<ScenarioTurnResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function send() {
    const content = input.trim();
    if (!content || loading) return;
    if (needsSupport(content)) { onHandoff(); return; }
    const nextMessages = [...messages, { role: 'user' as const, content }];
    setMessages(nextMessages);
    setInput(''); setError(''); setLoading(true);
    try {
      const result = await fetch('/api/scenario/turn', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId: SCENARIO_ID, messages: nextMessages }),
      });
      const payload: unknown = await result.json();
      if (!result.ok || !isScenarioTurnResponse(payload)) {
        const reason = payload && typeof payload === 'object' && typeof (payload as Record<string, unknown>).error === 'string'
          ? (payload as Record<string, unknown>).error as string : '暂时无法继续，请稍后再试';
        throw new Error(reason);
      }
      if (payload.action === 'handoff') { onHandoff(); return; }
      setMessages([...nextMessages, { role: 'assistant', content: payload.reply }]);
      setResponse(payload);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '暂时无法继续，请稍后再试');
    } finally { setLoading(false); }
  }

  function finish() {
    const expressions = messages.filter(message => message.role === 'user').map(message => `我的表达：${message.content}`);
    const feedback = response?.feedback ? `练习反馈：${response.feedback}` : '';
    onComplete([...expressions, feedback].filter(Boolean).join('\n'));
  }

  if (!started) return <Modal label="AI SCENARIO · 情境练习" title="练习表达自己的边界" onClose={onClose}
    actions={<><button className="secondary" onClick={onClose}>暂时不练</button><button className="primary" onClick={() => setStarted(true)}>进入情境 ↗</button></>}>
    <p className="intro">一位同学经常在大家面前拿你的考试成绩开玩笑。你想让对方停下来，又不想让冲突升级。</p>
    <div className="scenario-brief"><strong>你可以练习</strong><span>说清发生了什么</span><span>表达自己的感受</span><span>提出具体请求</span></div>
    <p className="modal-hint">练习最多三轮。你可以随时退出；出现安全风险时，系统会停止情境并打开现实支持。</p>
  </Modal>;

  const complete = response?.action === 'complete';
  return <Modal label="AI SCENARIO · 表达边界" title={complete ? '这次练习完成了' : '试着用自己的方式回应'} onClose={onClose}
    actions={complete
      ? <><button className="secondary" onClick={onClose}>不保存</button><button className="primary" onClick={finish}>保存练习 ✓</button></>
      : <><button className="secondary" onClick={onClose}>先到这里</button><button className="primary" disabled={!input.trim() || loading} onClick={send}>{loading ? '正在回应…' : '发送表达 →'}</button></>}>
    <div className="scenario-chat" aria-live="polite">
      {messages.map((message, index) => <div key={`${message.role}-${index}`} className={`scenario-message ${message.role}`}><small>{message.role === 'user' ? '我' : '同学'}</small><p>{message.content}</p></div>)}
      {loading && <div className="scenario-message assistant loading"><small>同学</small><p>正在想怎么回应…</p></div>}
    </div>
    {response && <div className="coach-panel"><div><strong>技能教练</strong><span className={`source-pill ${response.source}`}>{response.source === 'ai' ? 'AI 生成' : '预设练习'}</span></div><p>{response.coachHint}</p>{response.feedback && <p className="scenario-feedback">{response.feedback}</p>}</div>}
    {!complete && response?.suggestions.length ? <div className="suggestion-list"><span>需要一点提示时，可以参考：</span>{response.suggestions.map(suggestion => <button key={suggestion} onClick={() => setInput(suggestion)}>{suggestion}</button>)}</div> : null}
    {!complete && <><label className="field-label" htmlFor="scenario-answer">我想这样说</label><textarea id="scenario-answer" maxLength={500} value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') void send(); }} placeholder="用你平时会说的话表达，不需要写得完美。" /></>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {!complete && <button className="text-button" onClick={onHandoff}>我需要现实中的帮助</button>}
  </Modal>;
}
