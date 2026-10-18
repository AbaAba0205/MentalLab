'use client';

import { useState, type ReactNode } from 'react';
import { getExercise, type ExerciseId } from '@/lib/training/registry';
import { serializePractice, type StepAnswer } from '@/lib/training/dbt';
import { needsSupport, newRecord, type PracticeRecord } from '@/lib/model';
import { Intensity, Modal, PracticeTimer } from './practice-ui';

type Props = {
  exerciseId: ExerciseId;
  initialIntensity?: number;
  inline?: boolean;
  onClose: () => void;
  onHandoff: () => void;
  onSave: (record: PracticeRecord) => Promise<boolean>;
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
  const [answers, setAnswers] = useState<StepAnswer[]>([]);
  const [helpful, setHelpful] = useState('');
  const [reflection, setReflection] = useState('');
  const [useful, setUseful] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const step = exercise.steps[stepIndex];
  const guide = exercise.guide;
  const practiceNote = serializePractice(exercise.steps, answers);
  function next() {
    if (needsSupport(practiceNote)) { onHandoff(); return; }
    setError('');
    if (stepIndex === exercise.steps.length - 1) { setIntensity(before); setPhase('review'); }
    else setStepIndex(stepIndex + 1);
  }
  function answer(field: string, value: string | string[] | number) {
    setAnswers(previous => { const next = [...previous]; next[stepIndex] = { ...next[stepIndex], [field]: value }; return next; });
  }
  async function save() {
    if (saving) return;
    if (needsSupport([practiceNote, reflection, useful].join(' '))) { onHandoff(); return; }
    setSaving(true);
    try {
      const ok = await onSave(newRecord({ kind: 'exercise', title: exercise.title, before, after: intensity,
        note: [practiceNote, reflection.trim() && `${guide?.reflections[0] || '练习感受'}：${reflection.trim()}`, useful.trim() && `${guide?.reflections[1] || '有用的一点'}：${useful.trim()}`].filter(Boolean).join('\n\n'), helpful: helpful || '未评价' }));
      setSaved(ok);
      if (ok) setPhase('complete'); else setError('服务器未能保存，你填写的内容还在，请重试。');
    } finally { setSaving(false); }
  }
  let title = exercise.title;
  let body: ReactNode;
  let actions: ReactNode;
  const needsStabilization = exercise.maxIntensity !== undefined && intensity > exercise.maxIntensity;
  if (phase === 'intro') {
    body = <><p className="intro">{exercise.description}你可以随时退出，感到不舒服时就停下来。</p>{guide && <details className="skill-guide" open><summary>{guide.title}</summary><p>{guide.explanation}</p><ul>{guide.examples.map(item => <li key={item}>{item}</li>)}</ul><h4>可以试试的方法</h4><ul>{guide.methods.map(item => <li key={item}>{item}</li>)}</ul></details>}<Intensity id={inline ? 'chat-intensity' : 'intensity'} value={intensity} onChange={setIntensity} label={guide ? `练习前的${guide.metric}` : undefined} />{guide && <p className="modal-hint">从轻到重：{guide.levels.join(' · ')}</p>}<p className="modal-hint">困扰强度仅用于自我观察，不代表诊断。需要现实支持时，可以随时打开帮助。</p>{needsStabilization && <p className="intro">现在可以先放下分析和计划，试着稳一稳。等你感觉准备好了，再回来也可以。</p>}</>;
    actions = <><button className="secondary" onClick={onHandoff}>我需要帮助</button><button className="primary" onClick={() => { if (needsStabilization) setSelectedId('observe-body'); else { setBefore(intensity); setPhase('practice'); } }}>{needsStabilization ? '先试试稳定练习' : '我想试试 ↗'}</button></>;
  } else if (phase === 'practice') {
    title = step.title;
    body = <><div className="progress-track"><i style={{ width: ((stepIndex + 1) / (exercise.steps.length + 1) * 100) + '%' }} /></div><p className="intro">{step.intro}</p>
      {step.prompt && <div className="practice-prompt">{step.prompt}</div>}
      {step.examples && <ul className="practice-examples">{step.examples.map(item => <li key={item}>{item}</li>)}</ul>}
      {step.timer && <PracticeTimer id={inline ? 'chat-timer-value' : 'timer-value'} key={`${selectedId}-${stepIndex}`} durationSeconds={step.durationSeconds} breathing={step.breathing} />}
      {step.counter && <div className="practice-counter"><p>{step.counter}</p><output aria-live="polite" aria-label="计数">{Number(answers[stepIndex]?.count || 0)}</output><button className="primary" aria-label="增加一次" onClick={() => answer('count', Number(answers[stepIndex]?.count || 0) + 1)}>+</button><button className="text-button" onClick={() => answer('count', 0)}>清零计数</button></div>}
      {step.fields?.map((field, index) => {
        const value = answers[stepIndex]?.[field.id];
        const fieldId = `${inline ? 'chat-' : ''}answer${index ? `-${field.id}` : ''}`;
        if (field.choices) return <fieldset className="practice-field" key={field.id}><legend className="field-label">{field.label}</legend><div className="choice-grid">{field.choices.map(choice => {
          const selected = field.multiple ? Array.isArray(value) && value.includes(choice) : value === choice;
          return <button key={choice} className={`choice ${selected ? 'selected' : ''}`} data-choice={choice} aria-pressed={selected} onClick={() => {
            const current = Array.isArray(value) ? value : [];
            answer(field.id, field.multiple ? (selected ? current.filter(item => item !== choice) : [...current, choice]) : (selected ? '' : choice));
          }}>{choice}</button>;
        })}</div></fieldset>;
        return <div key={field.id}><label className="field-label" htmlFor={fieldId}>{field.label} <span>（选填）</span></label><textarea id={fieldId} maxLength={300} placeholder={field.placeholder} value={typeof value === 'string' ? value : ''} onChange={event => answer(field.id, event.target.value)} /></div>;
      })}
      {error && <p role="alert" className="form-error">{error}</p>}<button className="text-button" onClick={onHandoff}>我需要帮助</button></>;
    actions = <><button className="secondary" onClick={() => { setError(''); if (stepIndex === 0) onClose(); else setStepIndex(stepIndex - 1); }}>{stepIndex === 0 ? '先到这里' : '上一步'}</button><span className="step-count">{stepIndex + 1} / {exercise.steps.length}</span><button className="primary" onClick={next}>{stepIndex === exercise.steps.length - 1 ? '完成，去复盘' : '下一步'} →</button></>;
  } else if (phase === 'review') {
    title = '现在，感觉怎么样？';
    body = <><p className="intro">花 2 分钟感受一下练习前后的不同。情绪没有下降也没关系。</p><Intensity id={inline ? 'chat-intensity' : 'intensity'} value={intensity} onChange={setIntensity} label={guide ? `练习后的${guide.metric}` : '此刻的困扰强度'} />{guide && <p className="modal-hint">从轻到重：{guide.levels.join(' · ')}</p>}
      <p className="field-label">这次练习对你有帮助吗？</p><div className="choice-grid">{['有一点帮助', '暂时没感觉', '有点不舒服'].map(choice => <button key={choice} className={'choice ' + (helpful === choice ? 'selected' : '')} aria-pressed={helpful === choice} onClick={() => setHelpful(choice)}>{choice}</button>)}</div>
      <label className="field-label" htmlFor={inline ? 'chat-reflection' : 'reflection'}>{guide?.reflections[0] || '想给自己留下一句话吗？'}（选填）</label><textarea id={inline ? 'chat-reflection' : 'reflection'} maxLength={300} value={reflection} onChange={event => setReflection(event.target.value)} />
      {guide && <><label className="field-label" htmlFor={inline ? 'chat-useful' : 'useful'}>{guide.reflections[1]}（选填）</label><textarea id={inline ? 'chat-useful' : 'useful'} maxLength={300} value={useful} onChange={event => setUseful(event.target.value)} /></>}
      {inline && <p className="modal-hint">保存后可在“我的记录”查看。练习填写的内容不会自动发给 AI。</p>}{error && <p role="alert" className="form-error">{error}</p>}</>;
    actions = <><button className="secondary" disabled={saving} onClick={() => setPhase('practice')}>返回练习</button><button className="primary" disabled={saving} onClick={save}>保存这一步 ✓</button></>;
  } else {
    title = saved ? '这一小步，已经记下了' : '这一小步，已经完成了';
    body = <><div className="success-icon">✓</div><p className="intro">{helpful === '有点不舒服' ? '先停止这个练习，做些让自己舒服的事。若不适持续，可以寻求现实中的支持。' : '你不需要立刻变得更好。需要时，可以再回来，也可以向身边的人寻求支持。'}</p>
      {!saved && <p role="status">服务器未能保存，请重试。</p>}
      <div className="summary">{exercise.title}<br />困扰强度：{before} → {intensity} / 10<br />{reflection || '给自己一点时间，也给自己一点空间。'}</div></>;
    actions = <><button className="secondary" onClick={onClose}>{inline ? '回到聊天' : '回到空间'}</button>{onRecords && <button className="primary" onClick={onRecords}>看看我的记录 ↗</button>}</>;
  }
  const label = '小训练 · ' + exercise.title + ' · ' + exercise.time;
  if (inline) return <section className="inline-training" aria-label={label}><div className="modal-top"><span className="modal-label">{label}</span><button className="text-button" onClick={onClose}>暂停练习</button></div><h3 tabIndex={-1}>{title}</h3>{body}<div className="modal-actions">{actions}</div></section>;
  return <Modal label={label} title={title} onClose={onClose} actions={actions}>{body}</Modal>;
}
