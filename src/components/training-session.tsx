'use client';

import { useState, type ReactNode } from 'react';
import { getExercise, type ExerciseId } from '@/lib/training/registry';
import { needsSupport, newRecord, type PracticeRecord } from '@/lib/model';
import { Intensity, Modal, PracticeTimer } from './practice-ui';

type Props = {
  exerciseId: ExerciseId;
  initialIntensity?: number;
  inline?: boolean;
  onClose: () => void;
  onHandoff: () => void;
  onSave: (record: PracticeRecord) => boolean;
  onRecords?: () => void;
};

/** Executes any registered module; navigation and storage belong to the host. */
export function TrainingSession({ exerciseId, initialIntensity = 5, inline = false, onClose, onHandoff, onSave, onRecords }: Props) {
  const [selectedId, setSelectedId] = useState(exerciseId);
  const exercise = getExercise(selectedId);
  const [phase, setPhase] = useState<'intro' | 'practice' | 'review' | 'complete'>('intro');
  const [intensity, setIntensity] = useState(initialIntensity);
  const [before, setBefore] = useState(initialIntensity);
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [helpful, setHelpful] = useState('');
  const [reflection, setReflection] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const step = exercise.steps[stepIndex];
  function next() {
    if (needsSupport(answers.join(' '))) { onHandoff(); return; }
    if (step.required && !answers[stepIndex]?.trim()) { setError(step.choices ? '选一个你愿意尝试的选项，或先到这里' : '可以先写下一点内容，或选择先到这里'); return; }
    setError('');
    if (stepIndex === exercise.steps.length - 1) { setIntensity(before); setPhase('review'); }
    else setStepIndex(stepIndex + 1);
  }
  function answer(value: string) {
    setAnswers(previous => { const next = [...previous]; next[stepIndex] = value; return next; });
  }
  function save() {
    if (needsSupport([...answers, reflection].join(' '))) { onHandoff(); return; }
    setSaved(onSave(newRecord({ kind: 'exercise', title: exercise.title, before, after: intensity,
      note: [...answers, reflection].map(value => value?.trim()).filter(Boolean).join('\n'), helpful: helpful || '未评价' })));
    setPhase('complete');
  }
  let title = exercise.title;
  let body: ReactNode;
  let actions: ReactNode;
  const needsStabilization = exercise.maxIntensity !== undefined && intensity > exercise.maxIntensity;
  if (phase === 'intro') {
    body = <><p className="intro">{exercise.description}你可以随时退出，感到不舒服时就停下来。</p><Intensity id={inline ? 'chat-intensity' : 'intensity'} value={intensity} onChange={setIntensity} /><p className="modal-hint">困扰强度仅用于自我观察，不代表诊断。需要现实支持时，可以随时打开帮助。</p>{needsStabilization && <p className="intro">现在可以先放下分析和计划，试着稳一稳。等你感觉准备好了，再回来也可以。</p>}</>;
    actions = <><button className="secondary" onClick={onHandoff}>我需要帮助</button><button className="primary" onClick={() => { if (needsStabilization) setSelectedId('ground'); else { setBefore(intensity); setPhase('practice'); } }}>{needsStabilization ? '先试试稳定练习' : '我想试试 ↗'}</button></>;
  } else if (phase === 'practice') {
    title = step.title;
    body = <><div className="progress-track"><i style={{ width: ((stepIndex + 1) / (exercise.steps.length + 1) * 100) + '%' }} /></div><p className="intro">{step.intro}</p>
      {step.prompt && <div className="practice-prompt">{step.prompt}</div>}
      {step.placeholder && <><label className="field-label" htmlFor={inline ? 'chat-answer' : 'answer'}>我的想法 <span>（可以留空）</span></label><textarea id={inline ? 'chat-answer' : 'answer'} maxLength={500} placeholder={step.placeholder} value={answers[stepIndex] || ''} onChange={event => answer(event.target.value)} /></>}
      {step.choices && <div className="choice-grid">{step.choices.map(choice => <button key={choice} className={'choice ' + (answers[stepIndex] === choice ? 'selected' : '')} data-choice={choice} aria-pressed={answers[stepIndex] === choice} onClick={() => answer(choice)}>{choice}</button>)}</div>}
      {step.timer && <PracticeTimer id={inline ? 'chat-timer-value' : 'timer-value'} key={stepIndex} />}
      {error && <p role="alert" className="form-error">{error}</p>}<button className="text-button" onClick={onHandoff}>我需要帮助</button></>;
    actions = <><button className="secondary" onClick={() => { setError(''); if (stepIndex === 0) onClose(); else setStepIndex(stepIndex - 1); }}>{stepIndex === 0 ? '先到这里' : '上一步'}</button><span className="step-count">{stepIndex + 1} / {exercise.steps.length}</span><button className="primary" onClick={next}>{stepIndex === exercise.steps.length - 1 ? '完成，去复盘' : '下一步'} →</button></>;
  } else if (phase === 'review') {
    title = '现在，感觉怎么样？';
    body = <><p className="intro">情绪没有下降也没关系。愿意停下来照顾自己，就是这次练习的一部分。</p><Intensity id={inline ? 'chat-intensity' : 'intensity'} value={intensity} onChange={setIntensity} label="此刻的困扰强度" />
      <p className="field-label">这次练习对你有帮助吗？</p><div className="choice-grid">{['有一点帮助', '暂时没感觉', '有点不舒服'].map(choice => <button key={choice} className={'choice ' + (helpful === choice ? 'selected' : '')} aria-pressed={helpful === choice} onClick={() => setHelpful(choice)}>{choice}</button>)}</div>
      <label className="field-label" htmlFor={inline ? 'chat-reflection' : 'reflection'}>想给自己留下一句话吗？（选填）</label><textarea id={inline ? 'chat-reflection' : 'reflection'} maxLength={500} value={reflection} onChange={event => setReflection(event.target.value)} placeholder="比如：下次紧张时，我想先停下来看看窗外。" />
      {inline && <p className="modal-hint">保存后可在“我的记录”查看。练习填写的内容不会自动发给 AI。</p>}</>;
    actions = <><button className="secondary" onClick={() => setPhase('practice')}>返回练习</button><button className="primary" onClick={save}>保存这一步 ✓</button></>;
  } else {
    title = saved ? '这一小步，已经记下了' : '这一小步，已经完成了';
    body = <><div className="success-icon">✓</div><p className="intro">{helpful === '有点不舒服' ? '先停止这个练习，做些让自己舒服的事。若不适持续，可以寻求现实中的支持。' : '你不需要立刻变得更好。需要时，可以再回来，也可以向身边的人寻求支持。'}</p>
      {!saved && <p role="status">浏览器未允许保存，记录仅在当前页面有效。</p>}
      <div className="summary">{exercise.title}<br />困扰强度：{before} → {intensity} / 10<br />{reflection || '给自己一点时间，也给自己一点空间。'}</div></>;
    actions = <><button className="secondary" onClick={onClose}>{inline ? '回到聊天' : '回到空间'}</button>{onRecords && <button className="primary" onClick={onRecords}>看看我的记录 ↗</button>}</>;
  }
  const label = '小训练 · ' + exercise.title + ' · ' + exercise.time;
  if (inline) return <section className="inline-training" aria-label={label}><div className="modal-top"><span className="modal-label">{label}</span><button className="text-button" onClick={onClose}>暂停练习</button></div><h3 tabIndex={-1}>{title}</h3>{body}<div className="modal-actions">{actions}</div></section>;
  return <Modal label={label} title={title} onClose={onClose} actions={actions}>{body}</Modal>;
}
