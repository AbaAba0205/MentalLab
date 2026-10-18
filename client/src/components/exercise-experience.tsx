'use client';

import { useState, type ReactNode } from 'react';
import type { Exercise } from '@/lib/training/registry';
import type { ExerciseStep, PracticeField } from '@/lib/training/types';
import type { StepAnswer } from '@/lib/training/dbt';
import { stepPresentation } from '@/lib/training/presentation';
import { PracticeTimer } from './practice-ui';
import { PracticeGlyph, PracticeLandscape } from './practice-art';

type Value = string | string[] | number;
type Props = { exercise: Exercise; step: ExerciseStep; index: number; answers: StepAnswer[]; inline: boolean; onAnswer: (field: string, value: Value) => void };

function ExampleCards({ items, variant = '' }: { items?: string[]; variant?: string }) {
  if (!items) return null;
  return <ul className={`practice-examples experience-examples ${variant}`}>{items.map(item => <li key={item}><span className="example-copy">{item}</span></li>)}</ul>;
}

const activityIcons = ['dish', 'music', 'walk', 'book', 'meal', 'paint'];
const senseIcons = ['eye', 'ear', 'nose', 'taste', 'hand'];
const partPositions = [{ left: 50, top: 13 }, { left: 50, top: 38 }, { left: 50, top: 53 }, { left: 26, top: 31 }, { left: 20, top: 61 }, { left: 59, top: 82 }, { left: 52, top: 25 }, { left: 83, top: 92 }];

export function ExerciseCover({ exercise }: { exercise: Exercise }) {
  return <div className="experience-cover"><PracticeLandscape category={exercise.category} /><div className="cover-caption"><span>DBT · {exercise.category}</span><strong>{exercise.kind === 'guide' ? '先理解，再慢慢尝试' : '把这一刻，留给自己'}</strong><small>{exercise.steps.length} 个小步骤 · {exercise.time}</small></div></div>;
}

export function ExerciseExperience({ exercise, step, index, answers, inline, onAnswer }: Props) {
  const mode = stepPresentation(exercise.id, step, index);
  const value = answers[index] || {};
  const fields = step.fields || [];
  const [cloudIndex, setCloudIndex] = useState(0);
  const [cloudMoving, setCloudMoving] = useState(true);
  const [letterOpen, setLetterOpen] = useState(true);
  const [showStory, setShowStory] = useState(true);
  const [expandedMethod, setExpandedMethod] = useState<number | null>(null);
  const [counterPulse, setCounterPulse] = useState(0);

  function selected(field: PracticeField, choice: string) {
    const current = value[field.id];
    return field.multiple ? Array.isArray(current) && current.includes(choice) : current === choice;
  }
  function select(field: PracticeField, choice: string) {
    const current = Array.isArray(value[field.id]) ? value[field.id] as string[] : [];
    onAnswer(field.id, field.multiple ? (current.includes(choice) ? current.filter(item => item !== choice) : [...current, choice]) : (value[field.id] === choice ? '' : choice));
  }
  function renderField(field: PracticeField, extraClass = '', icon?: string) {
    const position = fields.indexOf(field);
    const fieldId = `${inline ? 'chat-' : ''}answer${position ? `-${field.id}` : ''}`;
    if (field.choices) return <fieldset className={`practice-field experience-field ${extraClass}`} key={field.id}><legend className="field-label">{field.label}</legend><div className="choice-grid">{field.choices.map((item, i) => <button type="button" key={item} className={`choice ${selected(field, item) ? 'selected' : ''}`} data-choice={item} aria-pressed={selected(field, item)} onClick={() => select(field, item)}>{icon && <PracticeGlyph name={icon === 'activities' ? activityIcons[i] : icon === 'scenarios' ? ['message', 'book', 'heart', 'moon'][i] : icon} />}<span>{item}</span>{selected(field, item) && <PracticeGlyph name="check" className="selection-check" />}</button>)}</div></fieldset>;
    return <div className={`experience-writing ${extraClass}`} key={field.id}>{icon && <PracticeGlyph name={icon} />}<label className="field-label" htmlFor={fieldId}>{field.label} <span>（选填）</span></label><textarea id={fieldId} maxLength={300} placeholder={field.placeholder || '在这里留下一点体验……'} value={typeof value[field.id] === 'string' ? value[field.id] as string : ''} onChange={event => onAnswer(field.id, event.target.value)} /></div>;
  }
  const remainingFields = (omit: string[] = []) => fields.filter(field => !omit.includes(field.id)).map(field => renderField(field));
  const timer = step.timer ? <PracticeTimer id={inline ? 'chat-timer-value' : 'timer-value'} durationSeconds={step.durationSeconds} breathing={step.breathing} variant={mode === 'daily' ? 'sunrise' : step.breathing ? 'breathing' : 'focus'} /> : null;
  const prior = (id: string) => answers.slice(0, index).map(answer => answer?.[id]).filter(item => typeof item === 'string' && item).at(-1) as string | undefined;
  let scene: ReactNode;

  if (mode === 'lesson') {
    scene = <div className={`lesson-studio lesson-${index}`}>
      {index === 0 && <><PracticeLandscape category={exercise.category} /><div className="lesson-definition"><span className="experience-kicker">认识 · {exercise.category}</span><strong>{exercise.category === '参与' ? '一心一用，投入此刻' : exercise.category === '观察' ? '不追、不赶，只是看见' : exercise.category === '智慧心' ? '感受与事实，可以同时存在' : '给体验一个清楚的名字'}</strong></div></>}
      {exercise.category === '智慧心' && index !== 2 && <MindDiagram />}
      {index === 1 && <ExampleCards items={step.examples} variant="lesson-comparison" />}
      {index === 2 && <ul className="practice-examples experience-examples method-deck">{step.examples?.map((item, i) => <li key={item}><button type="button" aria-expanded={expandedMethod === i} onClick={() => setExpandedMethod(expandedMethod === i ? null : i)}><span className="method-number" aria-hidden="true">0{i + 1}</span><span className="example-copy">{item}</span><span aria-hidden="true">{expandedMethod === i ? '−' : '+'}</span></button>{expandedMethod === i && <p>慢慢读一遍，在心里想一个今天可以用到它的时刻。</p>}</li>)}</ul>}
    </div>;
  } else if (mode === 'activity') {
    scene = <div className="activity-studio"><div className="studio-heading"><PracticeGlyph name="leaf" /><span>从一件平常的小事开始</span></div>{fields.map(field => renderField(field, field.id === 'activity' ? 'activity-picker' : 'custom-activity', field.id === 'activity' ? 'activities' : undefined))}</div>;
  } else if (mode === 'intention') {
    scene = <div className="intention-studio"><div className="intention-card"><PracticeGlyph name="focus" /><span>现在，只做这一件事</span><strong>{prior('own') || prior('activity') || '你选的那件小事'}</strong><small>不赶时间，也不评价自己</small></div>{remainingFields()}</div>;
  } else if (mode === 'senses') {
    scene = <div className="senses-notebook">{fields.map((field, i) => <div className={`sense-page sense-${i}`} key={field.id}><div className="sense-caption"><PracticeGlyph name={senseIcons[i]} /><small>0{i + 1} / 五感</small></div>{renderField(field)}<span className="sense-footnote">{['让目光停留一会儿', '听见身边细小的声音', '空气里有什么气味', '留意嘴里的味道', '感受皮肤与世界的接触'][i]}</span></div>)}</div>;
  } else if (mode === 'clouds') {
    const thoughts = exercise.steps[0].examples || [];
    const current = thoughts[cloudIndex % thoughts.length];
    scene = <><div className={`cloud-sky ${cloudMoving ? '' : 'motion-paused'}`}><span className="sky-caption">想法是云，你是天空</span><i className="sky-cloud cloud-back-one" /><i className="sky-cloud cloud-back-two" /><div className="thought-cloud" key={cloudIndex}><PracticeGlyph name="cloud" /><span aria-live="polite">{current}</span></div><div className="sky-hills" /><div className="sky-controls"><button type="button" className="scene-button" onClick={() => {
      const noticed = Array.isArray(value.noticedClouds) ? value.noticedClouds : [];
      onAnswer('noticedClouds', [...new Set([...noticed, current])]);
      setCloudIndex(previous => previous + 1);
    }}>我注意到了，让它飘过 <span aria-hidden="true">→</span></button><button type="button" className="text-button" onClick={() => setCloudMoving(!cloudMoving)}>{cloudMoving ? '暂停云朵动画' : '继续云朵动画'}</button></div></div>
      {index === 0 ? <><ExampleCards items={step.examples} variant="cloud-thought-list" /><p className="scene-caption" role="status">{Array.isArray(value.noticedClouds) && value.noticedClouds.length ? `你已经注意到 ${value.noticedClouds.length} 朵想法云` : '每次注意到，再轻轻放手，就是一次练习。'}</p></> : remainingFields()}</>;
  } else if (mode === 'body') {
    const parts = fields.find(field => field.id === 'parts')!;
    scene = <div className="body-studio"><fieldset className="practice-field body-field"><legend className="field-label">{parts.label}</legend><div className="body-map"><svg viewBox="0 0 240 340" aria-hidden="true"><ellipse cx="120" cy="323" rx="58" ry="8" fill="currentColor" opacity=".08" /><circle cx="120" cy="45" r="23" fill="currentColor" opacity=".13" /><path d="M106 69v17L79 96 60 184q-1 10 10 10l17-64 7 72-9 100q0 11 13 8l22-96 22 96q13 3 13-8l-9-100 7-72 17 64q11 0 10-10l-19-88-27-10V69" fill="currentColor" fillOpacity=".1" stroke="currentColor" strokeOpacity=".35" strokeWidth="2" /><path d="M103 137q17 10 34 0m-29 40q12 6 24 0" stroke="currentColor" opacity=".3" fill="none" /></svg>{parts.choices?.map((part, i) => <button type="button" style={{ left: `${partPositions[i].left}%`, top: `${partPositions[i].top}%` }} className={`body-point choice ${selected(parts, part) ? 'selected' : ''}`} aria-pressed={selected(parts, part)} data-choice={part} key={part} onClick={() => select(parts, part)}><i aria-hidden="true" /><span>{part}</span></button>)}</div><small className="scene-caption">点亮身体上有感觉的地方</small></fieldset><div className="body-sensations">{remainingFields(['parts'])}<div className="body-note"><PracticeGlyph name="heart" /><span>只需要注意到，不必让感觉变成别的样子。</span></div></div></div>;
  } else if (mode === 'labels') {
    const tags = Array.isArray(value.labels) ? value.labels : [];
    scene = <div className="label-studio"><div className="conveyor-scene"><span className="experience-kicker">想法分拣站</span><div className="parcel-line" aria-live="polite">{tags.length ? tags.map(tag => <span className="thought-parcel" key={tag}><PracticeGlyph name="book" />{tag.replace('这是一个', '')}</span>) : <span className="empty-parcel"><PracticeGlyph name="book" />不拆开分析，贴好标签就放下</span>}</div><div className="conveyor-belt" /></div>{fields.map(field => renderField(field, field.id === 'labels' ? 'tag-picker' : 'label-note'))}</div>;
  } else if (mode === 'wave') {
    const wave = fields.find(field => field.id === 'wave')!;
    const chosen = wave.choices?.indexOf(String(value.wave)) ?? -1;
    scene = <><div className="wave-studio"><div className="wave-caption"><PracticeGlyph name="wave" /><span>冲动像海浪，会有起伏</span></div><svg viewBox="0 0 600 200" className="urge-wave" aria-hidden="true"><path d="M0 171C120 171 133 40 280 40s175 131 320 131v29H0Z" fill="currentColor" opacity=".1" /><path d="M0 171C120 171 133 40 280 40s175 131 320 131" stroke="currentColor" strokeWidth="3" fill="none" />{chosen >= 0 && chosen < 3 && <><circle cx={[115, 280, 452][chosen]} cy={[115, 40, 130][chosen]} r="15" fill="currentColor" opacity=".17" /><circle cx={[115, 280, 452][chosen]} cy={[115, 40, 130][chosen]} r="6" fill="currentColor" /></>}</svg>{renderField(wave, 'wave-phases')}<small className="scene-caption" aria-live="polite">{chosen < 0 ? '你感觉自己在浪的哪个位置？' : chosen === 3 ? '暂时不确定也没关系，继续观察就好。' : ['留意它如何慢慢变强。', '让自己站在岸边，给它一点时间。', '留意身体和冲动怎样变化。'][chosen]}</small></div>{remainingFields(['wave'])}</>;
  } else if (mode === 'return-counter' || mode === 'notice-counter') {
    const count = Number(value.count || 0);
    scene = <><div className={`attention-studio ${mode}`}><div className="attention-orbit"><div className="orbit-track" /><span className="orbit-dot" style={{ transform: `rotate(${count * 29}deg) translateY(-89px)` }} /><button type="button" className="notice-stone" aria-label="增加一次" onClick={() => { onAnswer('count', count + 1); setCounterPulse(n => n + 1); }}><PracticeGlyph name={mode === 'return-counter' ? 'leaf' : 'eye'} /><output aria-live="polite" aria-label="计数">{count}</output><span>{mode === 'return-counter' ? '回来一次' : '注意到一次'} <b aria-hidden="true">＋</b></span></button><i className="attention-ripple" key={counterPulse} /></div><p>{step.counter}</p><button type="button" className="text-button" onClick={() => onAnswer('count', 0)}>清零计数</button>{timer}</div>{remainingFields()}</>;
  } else if (mode === 'rating') {
    const rating = fields.find(field => field.id === 'rating')!;
    const score = rating.choices?.indexOf(String(value.rating)) ?? -1;
    scene = <><div className="immersion-meter"><svg viewBox="0 0 240 145" aria-hidden="true"><path d="M30 120a90 90 0 0 1 180 0" pathLength="100" fill="none" stroke="currentColor" strokeWidth="16" opacity=".12" strokeLinecap="round" /><path d="M30 120a90 90 0 0 1 180 0" pathLength="100" fill="none" stroke="currentColor" strokeWidth="16" strokeDasharray={`${(score + 1) * 20} 100`} strokeLinecap="round" /><path d="M120 112 120 52" stroke="currentColor" strokeWidth="3" strokeLinecap="round" transform={`rotate(${-90 + (score < 0 ? 0 : score * 45)} 120 112)`} /><circle cx="120" cy="112" r="7" fill="currentColor" /></svg><strong aria-live="polite">{score < 0 ? '此刻，你投入了多少？' : rating.choices![score]}</strong>{renderField(rating, 'rating-picker')}</div>{remainingFields(['rating'])}</>;
  } else if (mode === 'daily') {
    scene = <div className="daily-studio"><div className="day-path" aria-label="早中晚练习进度">{['早', '中', '晚'].map((label, i) => <div className={i === index ? 'current' : i < index ? 'visited' : ''} key={label}><span><PracticeGlyph name={i === 2 ? 'moon' : 'sun'} /></span><small>{label} · 1 分钟</small>{answers[i]?.completed === '已完成' && <PracticeGlyph name="check" />}</div>)}</div><div className={`moment-card moment-${index}`}><span className="experience-kicker">把练习，放进平常的一天</span><PracticeLandscape category={index === 2 ? '观察' : '参与'} />{timer}<button type="button" className={`moment-complete ${value.completed ? 'completed' : ''}`} aria-pressed={value.completed === '已完成'} onClick={() => onAnswer('completed', value.completed ? '' : '已完成')}><PracticeGlyph name="check" />{value.completed ? '这一分钟，已经练习过了' : '我完成了这一分钟'}</button></div>{remainingFields()}</div>;
  } else if (mode === 'decision') {
    scene = <div className="decision-studio">{fields.filter(field => field.id === 'decision').map(field => renderField(field, 'decision-question', 'story'))}<div className="decision-fork" aria-hidden="true"><svg viewBox="0 0 440 65"><path d="M220 5v15c0 25-120 5-120 40M220 20c0 25 120 5 120 40" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 5" /></svg></div><div className="decision-options">{fields.filter(field => field.id !== 'decision').map((field, i) => <div className={`decision-branch branch-${i}`} key={field.id}><span className="branch-mark" aria-hidden="true">{i === 0 ? 'A' : 'B'}</span>{renderField(field)}<small>给这个选择一点空间</small></div>)}</div></div>;
  } else if (mode === 'minds') {
    scene = <div className="minds-studio">{fields.filter(field => field.id === 'decision').map(field => renderField(field, 'decision-question'))}<MindDiagram /><div className="mind-pages">{fields.filter(field => field.id !== 'decision').map((field, i) => <div className={`mind-page ${i === 0 ? 'emotion-page' : 'reason-page'}`} key={field.id}><PracticeGlyph name={i === 0 ? 'heart' : 'brain'} />{renderField(field)}</div>)}</div><p className="mind-bridge">先听见两种声音，再给整合留一点安静。</p></div>;
  } else if (mode === 'letter') {
    scene = <div className="letter-studio"><div className="letter-envelope"><PracticeGlyph name="mail" /><span>一封写给此刻的你的信</span><button type="button" className="text-button" aria-expanded={letterOpen} onClick={() => setLetterOpen(!letterOpen)}>{letterOpen ? '暂时合上信纸' : '展开这封信'}</button></div><div className="friend-letter" hidden={!letterOpen}><div className="letter-date">给正在努力的你</div><p className="letter-salutation">亲爱的自己：</p>{fields.map(field => renderField(field, 'letter-line'))}<p className="letter-signature">一直关心你的<br /><strong>智慧朋友</strong><PracticeGlyph name="leaf" /></p></div></div>;
  } else if (mode === 'wisdom') {
    scene = <div className="wisdom-studio"><MindDiagram /><div className="wisdom-note"><span className="experience-kicker">既承认感受，也看见事实</span>{fields.map(field => renderField(field, field.id === 'action' ? 'action-note' : 'wisdom-line', field.id === 'action' ? 'walk' : 'leaf'))}</div></div>;
  } else if (mode === 'facts') {
    const facts = index === 0;
    scene = <div className={`fact-studio ${facts ? 'camera-mode' : index === 1 ? 'story-mode' : 'comparison-mode'}`}>
      {index < 2 ? <><div className="perspective-card"><PracticeGlyph name={facts ? 'camera' : 'story'} /><span className="experience-kicker">{facts ? '摄像头视角' : '脑海里的旁白'}</span><strong>{facts ? '只记录，看见与听见的' : '这是我的解读，还不是全部事实'}</strong><div className="camera-corner tl" /><div className="camera-corner br" /></div>{index === 1 && prior('fact') && <blockquote className="previous-fact">刚才记录的事实：{prior('fact')}</blockquote>}{remainingFields()}</>
        : <><div className="perspective-switch"><button type="button" aria-pressed={!showStory} onClick={() => setShowStory(false)}>只看事实</button><button type="button" aria-pressed={showStory} onClick={() => setShowStory(true)}>也看看解读</button></div><div className="fact-comparison"><div><PracticeGlyph name="camera" /><small>事实 · 可以被记录</small><p>{prior('fact') || '回想刚才看见、听见的事'}</p></div>{showStory && <div><PracticeGlyph name="story" /><small>解读 · 脑子加的故事</small><p>{prior('interpretation') || '留意脑子里自动出现的猜测'}</p></div>}</div>{remainingFields()}</>}
    </div>;
  } else if (mode === 'rewrite') {
    const thought = String(value.thought || '……');
    scene = <div className="rewrite-studio">{fields.filter(field => field.id === 'original').map(field => renderField(field, 'original-thought'))}<div className="glass-thought"><span className="experience-kicker">给想法，加一层温柔的距离</span><p>我注意到我有一个想法：</p><strong aria-live="polite">{thought}</strong><span className="glass-shine" /></div><div className="sentence-strips">{fields.filter(field => field.id !== 'original').map((field, i) => renderField(field, `sentence-strip strip-${i}`, ['story', 'heart', 'hand'][i]))}</div></div>;
  } else if (mode === 'scenario') {
    scene = <div className="scenario-postcards"><span className="experience-kicker">生活里的一帧画面</span>{fields.map(field => renderField(field, field.id === 'scenario' ? 'scenario-picker' : 'own-scenario', field.id === 'scenario' ? 'scenarios' : undefined))}</div>;
  } else if (mode === 'body-journal') {
    scene = <div className="body-journal"><div className="body-journal-heading"><PracticeGlyph name="hand" /><span>给身体的感觉，起一个名字</span></div>{remainingFields()}</div>;
  } else {
    scene = <div className={`focus-studio ${mode === 'breathing' ? 'breath-studio' : ''}`}><div className="focus-caption"><PracticeGlyph name={mode === 'breathing' ? 'leaf' : 'focus'} /><span>{mode === 'breathing' ? '不急着找答案，先跟着呼吸' : '在这一分钟，回到正在做的事'}</span></div>{timer}{mode === 'breathing' && <div className="breath-reminder"><span>吸气 · 腹部轻轻鼓起</span><i /><span>呼气 · 慢慢放松下来</span></div>}<ExampleCards items={step.examples} variant="focus-cues" />{remainingFields()}</div>;
  }
  return <section className={`exercise-scene scene-${mode}`} data-presentation={mode}>{scene}</section>;
}

function MindDiagram() {
  return <div className="three-minds" aria-label="情绪心与理性心整合为智慧心"><div className="mind-circle emotion-mind"><PracticeGlyph name="heart" /><span>情绪心</span></div><div className="mind-circle reason-mind"><PracticeGlyph name="brain" /><span>理性心</span></div><div className="wise-center"><PracticeGlyph name="leaf" /><span>智慧心</span></div></div>;
}
