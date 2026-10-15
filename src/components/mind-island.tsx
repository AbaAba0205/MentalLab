'use client';

import Image from 'next/image';
import { useEffect, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { exercises, moods, newRecord, readRecords, recommendation, needsSupport, seedRecords, storageKey, type Exercise, type ExerciseId, type PracticeRecord } from '@/lib/model';
import { exerciseCategories } from '@/lib/training/registry';
import { TrainingSession } from './training-session';
import { CompanionChat } from './companion-chat';
import { Courses } from './courses';
import { Icon } from './icon';
import { Intensity, Modal, MoodButtons } from './practice-ui';
import { ScenarioPractice } from './scenario-practice';
import { Onboarding } from './onboarding';
import { SidebarReminder } from './sidebar-reminder';

type View = 'chat' | 'courses' | 'today' | 'exercises' | 'records';
type Screen = 'checkin' | 'recommendation' | 'training' | 'scenario' | 'help' | 'privacy' | 'clear' | 'delete' | null;
type AIStatus = 'checking' | 'configured' | 'not-configured';
const onboardingKey = 'mind-island-onboarding-v2';
const navigation: { id: View; title: string; icon: string }[] = [
  { id: 'chat', title: '随心聊', icon: 'message' },
  { id: 'courses', title: '课程', icon: 'book' },
  { id: 'today', title: '今日空间', icon: 'grid' },
  { id: 'exercises', title: '练习室', icon: 'leaf' },
  { id: 'records', title: '我的记录', icon: 'book' },
];
const subscribe = () => () => {};

// Browser records must not be read during server rendering or overwrite the initial store.
export default function MindIsland() {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  return mounted ? <Workspace /> : <main className="rounded-3xl p-8" aria-busy="true"><h1>心晴</h1><p role="status">正在打开你的小岛…</p><noscript>请开启 JavaScript 后使用互动练习。</noscript></main>;
}

function loadRecords(): PracticeRecord[] {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw === null ? seedRecords() : readRecords(raw);
  } catch { return seedRecords(); }
}

function needsOnboarding() {
  try { return localStorage.getItem(onboardingKey) !== 'accepted'; }
  catch { return true; }
}

function ScenarioCard({ onStart }: { onStart: () => void }) {
  return <section className="scenario-card">
    <div className="scenario-card-icon"><Icon name="message" /></div>
    <div><span className="scenario-kicker">AI 情境练习 · 3 轮</span><h2>练习向同学表达边界</h2><p>在一个安全、有限的模拟场景里，说清自己的感受和希望。</p></div>
    <button className="primary" onClick={onStart}>进入情境 <span>↗</span></button>
  </section>;
}

function ExerciseCard({ exercise, onStart }: { exercise: Exercise; onStart: (id: ExerciseId) => void }) {
  return <article className={`exercise-card ${exercise.color}`}>
    <div className="exercise-top"><div className="exercise-icon"><Icon name={exercise.icon} /></div><span className="duration"><Icon name="clock" />{exercise.time}</span></div>
    <h3>{exercise.title}</h3><p>{exercise.subtitle}</p>
    <div className="exercise-bottom"><span className="category">{exercise.category}</span><button className="round-arrow" data-exercise={exercise.id} aria-label={`开始${exercise.title}`} onClick={() => onStart(exercise.id)}>↗</button></div>
  </article>;
}

function Recent({ record, onDelete }: { record: PracticeRecord; onDelete?: (id: string) => void }) {
  return <div className="recent-row">
    <span className="record-symbol"><Icon name={record.kind === 'exercise' ? 'flower' : 'book'} /></span>
    <div><h3>{record.title}{record.demo && <> <span className="tiny-pill">示例</span></>}</h3><p>{new Date(record.date).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })} · {record.kind === 'exercise' ? record.helpful || '完成一次练习' : record.mood || '记录了此刻'}</p></div>
    <div className="record-actions"><span className="record-end">{record.after !== null ? <>{record.before ?? '—'} → {record.after} <small>/ 10</small></> : '已记录'}</span>
      {onDelete && <button className="delete-button" aria-label={`删除${record.title}记录`} onClick={() => onDelete(record.id)}>删除</button>}
    </div>
  </div>;
}

function Workspace() {
  const [records, setRecords] = useState(loadRecords);
  const [showOnboarding, setShowOnboarding] = useState(needsOnboarding);
  const [aiStatus, setAIStatus] = useState<AIStatus>('checking');
  const [aiModel, setAIModel] = useState('DeepSeek-V4.1-Flash');
  const [now] = useState(() => new Date());
  const [view, setView] = useState<View>('chat');
  const [filter, setFilter] = useState('全部');
  const [recordFilter, setRecordFilter] = useState('全部');
  const [screen, setScreen] = useState<Screen>(null);
  const [message, setMessage] = useState('');
  const [mood, setMood] = useState('');
  const [intensity, setIntensity] = useState(5);
  const [note, setNote] = useState('');
  const [exerciseId, setExerciseId] = useState<ExerciseId>('ground');
  const [before, setBefore] = useState(5);
  const [deleteId, setDeleteId] = useState('');
  const exercise = exercises.find(e => e.id === exerciseId)!;
  const close = () => setScreen(null);

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(''), 3200);
    return () => window.clearTimeout(timeout);
  }, [message]);

  useEffect(() => {
    let active = true;
    fetch('/api/health', { cache: 'no-store' }).then(response => response.json()).then((value: unknown) => {
      if (!active || !value || typeof value !== 'object') return;
      const health = value as Record<string, unknown>;
      setAIStatus(health.ai === 'configured' ? 'configured' : 'not-configured');
      if (typeof health.model === 'string' && health.model.trim()) setAIModel(health.model);
    }).catch(() => { if (active) setAIStatus('not-configured'); });
    return () => { active = false; };
  }, []);

  function persist(next: PracticeRecord[]) {
    setRecords(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); return true; }
    catch { setMessage('浏览器未允许保存，变更仅在当前页面有效；刷新后请检查记录'); return false; }
  }
  function acceptOnboarding() {
    try { localStorage.setItem(onboardingKey, 'accepted'); } catch { /* Continue for this browser session. */ }
    setShowOnboarding(false);
  }
  function completeScenario(summary: string) {
    persist([newRecord({ kind: 'exercise', title: '表达边界情境练习', note: summary, helpful: '完成情境练习' }), ...records]);
    setScreen(null); setMessage('情境练习已保存到我的记录');
  }
  function navigate(next: View) { setView(next); window.scrollTo({ top: 0 }); }
  function checkin(selected = '') { setMood(selected); setIntensity(5); setNote(''); setScreen('checkin'); }
  function start(id: ExerciseId, initial = 5) {
    setExerciseId(id); setBefore(initial); setScreen('training');
  }
  function saveCheckin() {
    if (needsSupport(note)) { setScreen('help'); return; }
    persist([newRecord({ kind: 'checkin', title: '情绪签到', mood: moods.find(m => m.id === mood)?.label || '未选择', before: intensity, note: note.trim() }), ...records]);
    setBefore(intensity); setExerciseId(recommendation(intensity)); setScreen('recommendation');
  }
  const headings = {
    chat: ['A SPACE TO BE YOURSELF', '随心聊，慢慢说', '想说什么都可以从一点点开始，不必整理好心情。'],
    courses: ['LEARN AT YOUR OWN PACE', '给成长留一点空间', '在理解自己之前，先认识情绪。'],
    today: ['A LITTLE SPACE, JUST FOR YOU', '嗨，今天的你还好吗？', '在这里，放慢一点，听听自己的声音。'],
    exercises: ['SMALL PRACTICES, GENTLE CHANGES', '给自己一点练习的时间', '不必做得完美，选一个现在适合你的练习。'],
    records: ['EVERY LITTLE STEP COUNTS', '每一小步，都在这里', '记录感受，也记住那些愿意照顾自己的时刻。'],
  }[view];
  const visible = records.filter(r => recordFilter === '全部' || r.kind === (recordFilter === '练习复盘' ? 'exercise' : 'checkin'));
  const completed = records.filter(r => r.kind === 'exercise' && now.getTime() - Date.parse(r.date) < 7 * 86400000).length;

  return <>
    <div className={`app-shell${view === 'chat' ? ' chat-workspace' : ''}`}>
      <aside className="sidebar">
        <a className="brand" href="#chat" aria-label="心晴首页" onClick={e => { e.preventDefault(); navigate('chat'); }}><span className="brand-symbol">♥</span><span>心晴<small>XINQING</small></span></a>
        <div className="workspace-label">你的情绪小空间</div>
        <nav aria-label="主导航">{navigation.map(item => <button key={item.id} className={`nav-item ${view === item.id ? 'active' : ''}`} data-view={item.id} aria-current={view === item.id ? 'page' : undefined} onClick={() => navigate(item.id)}><Icon name={item.icon} />{item.title}<span className="nav-dot" /></button>)}</nav>
        <SidebarReminder />
        <div className="sidebar-bottom"><button className="support-link" onClick={() => setScreen('help')}><Icon name="lifebuoy" />我需要一些帮助 <span>↗</span></button><div className="profile"><div className="avatar">Y</div><div>我的小岛<small>今天也在慢慢成长</small></div><span className="profile-spark">✧</span></div></div>
      </aside>
      <main>
        <header className="topbar"><div><span className="breadcrumb">我的小岛</span><span className="slash">/</span><span id="page-crumb">{navigation.find(n => n.id === view)?.title}</span></div><div className="topbar-right"><span className={`demo-badge ${aiStatus}`}><i />{aiStatus === 'configured' ? 'AI 已配置' : aiStatus === 'checking' ? '正在检查 AI' : '预设模式'}</span><button className="icon-button" aria-label="寻求帮助" title="寻求帮助" onClick={() => setScreen('help')}><Icon name="lifebuoy" /></button><button className="icon-button" aria-label="本地数据说明" onClick={() => setScreen('privacy')}><Icon name="shield" /></button><div className="small-avatar">Y</div></div></header>
        <div id="page" className="page">
          <div className="eyebrow">{headings[0]}</div><div className="welcome"><div><h1>{headings[1]}<span aria-hidden="true">✧</span></h1><p>{headings[2]}</p></div>{view === 'today' && <div className="date-pill"><Icon name="calendar" />{now.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}</div>}</div>
          <div className="chat-view" hidden={view !== 'chat'}><CompanionChat active={view === 'chat'} model={aiModel} onHandoff={() => setScreen('help')} onSave={record => persist([record, ...records])} /></div>
          {view === 'courses' && <Courses onPractice={() => navigate('exercises')} />}
          {view === 'today' && <>
            <div className="hero-grid"><section className="hero"><div className="hero-copy"><span className="hero-label">TAKE A BREATH</span><h2>不用急着找到答案，<br />先照顾此刻的自己。</h2><p>从一次情绪签到开始，<br />找到今天适合你的那一小步。</p><button className="primary" onClick={() => checkin()}>开始情绪签到 <span>↗</span></button></div><Image className="hero-art" src="/island-garden.svg" alt="" width={310} height={265} priority /></section>
              <section className="week-card"><div className="card-heading">本周的小脚印<span className="tiny-pill">近 7 天</span></div><div className="week-number">{completed}<span>次用心练习</span></div><div className="week-bars">{Array.from({ length: 7 }, (_, i) => {
                const day = new Date(now); day.setDate(day.getDate() - 6 + i);
                const count = records.filter(r => new Date(r.date).toDateString() === day.toDateString()).length;
                return <div className="day" key={i}><i style={{ '--height': `${Math.min(43, 7 + count * 18)}px` } as CSSProperties} /><span>{['日', '一', '二', '三', '四', '五', '六'][day.getDay()]}</span></div>;
              })}</div><p>每一次停下来，都是在照顾自己。<br />{records.some(r => r.demo) ? '含示例记录' : '来自你的记录'}</p></section>
            </div>
            <section><div className="section-heading"><div><h2>今天，想从哪里开始？</h2><p>为考试前的你，准备了三个小练习</p></div><button className="text-button" onClick={() => navigate('exercises')}>探索练习室 <span>↗</span></button></div><div className="exercise-grid">{exercises.map(ex => <ExerciseCard key={ex.id} exercise={ex} onStart={start} />)}</div></section>
            <ScenarioCard onStart={() => setScreen('scenario')} />
            <div className="bottom-grid"><section className="checkin-card"><div className="small-heading"><h2>此刻的心情，像哪一种？</h2><span>没有标准答案</span></div><MoodButtons onSelect={checkin} /></section><section className="recent-card"><div className="small-heading"><h2>最近的小小进展</h2><button className="text-button" onClick={() => navigate('records')}>查看全部 ↗</button></div>{records.slice(0, 2).map(r => <Recent key={r.id} record={r} />)}{records.length === 0 && <p className="no-records">你的第一条记录，会从这里开始。</p>}</section></div>
          </>}
          {view === 'exercises' && <>
            <ScenarioCard onStart={() => setScreen('scenario')} />
            <div className="filters" aria-label="练习分类">{['全部', ...exerciseCategories].map(f => <button key={f} className={`filter ${filter === f ? 'active' : ''}`} aria-pressed={filter === f} onClick={() => setFilter(f)}>{f}</button>)}</div>
            <div className="exercise-grid">{exercises.filter(e => filter === '全部' || e.category === filter).map(ex => <ExerciseCard key={ex.id} exercise={ex} onStart={start} />)}</div>
            <div className="library-intro">✧ 你可以随时暂停或跳过。练习的目的不是消除所有情绪，而是多一种照顾自己的方式。</div>
          </>}
          {view === 'records' && <>
            <div className="filters">{['全部', '情绪签到', '练习复盘'].map(f => <button key={f} className={`filter ${recordFilter === f ? 'active' : ''}`} aria-pressed={recordFilter === f} onClick={() => setRecordFilter(f)}>{f}</button>)}</div>
            <p className="eyebrow">保存在当前浏览器 · 可随时删除 · 带“示例”的记录为模拟数据</p>
            <div className="record-list">{visible.map(r => <article className="full-record" key={r.id}><Recent record={r} onDelete={id => { setDeleteId(id); setScreen('delete'); }} /><p>{r.note}</p></article>)}{visible.length === 0 && <div className="empty"><h2>这里还没有记录</h2><p>从一次小小的签到，认识此刻的自己。</p><button className="primary" onClick={() => checkin()}>开始情绪签到 ↗</button></div>}</div>
          </>}
        </div>
        <footer>每一种情绪，都值得被看见。<span>心理健康技能练习 · 不提供诊断或治疗</span></footer>
      </main>
    </div>

    {showOnboarding && <Onboarding onAccept={acceptOnboarding} />}
    {screen === 'scenario' && <ScenarioPractice onClose={close} onComplete={completeScenario} onHandoff={() => setScreen('help')} />}

    {screen === 'checkin' && <Modal key={screen} label="EMOTIONAL CHECK-IN · 情绪签到" title="先听听此刻的自己" onClose={close} actions={<><button className="secondary" onClick={close}>暂时不记录</button><button className="primary" onClick={saveCheckin}>记录此刻，看看推荐 ↗</button></>}>
      <p className="intro">用你舒服的方式记录。不想填写的内容，可以留空。</p><MoodButtons selected={mood} onSelect={setMood} /><Intensity value={intensity} onChange={setIntensity} />
      <label className="field-label" htmlFor="note">发生了什么？<span>（选填）</span></label><textarea id="note" maxLength={500} value={note} onChange={e => setNote(e.target.value)} placeholder="比如：想到明天的考试，心里有一点紧张……" />
      <p className="modal-hint">仅保存于当前浏览器。开发预览请使用虚构内容。</p>
    </Modal>}
    {screen === 'recommendation' && <Modal key={screen} label="A MOMENT FOR YOU · 已记录" title="谢谢你，愿意照顾自己" onClose={close} actions={<><button className="secondary" onClick={() => { close(); navigate('exercises'); }}>自己选一个</button><button className="primary" onClick={() => start(exerciseId, before)}>试试这个练习 ↗</button></>}>
      <div className="success-icon">✓</div><p className="intro">{before >= 4 ? '先把分析和计划放一放。可以试着把注意力带回身边。' : '如果你愿意，可以为接下来选一个轻松的小行动。'}</p><div className="summary">推荐练习：{exercise.title}<br />{exercise.description}</div><p className="modal-hint">这是预设规则生成的推荐，不是心理评估。你也可以选择其他练习。</p>
    </Modal>}
    {screen === 'training' && <TrainingSession exerciseId={exerciseId} initialIntensity={before} onClose={close} onHandoff={() => setScreen('help')} onSave={record => persist([record, ...records])} onRecords={() => { close(); setRecordFilter('全部'); navigate('records'); }} />}
    {screen === 'help' && <Modal key={screen} label="REAL-WORLD SUPPORT · 现实中的支持" title="你可以寻求身边的帮助" onClose={close} actions={<button className="secondary" onClick={close}>关闭帮助页</button>}>
      <p className="intro">如果你现在可能伤害自己或他人，或正在遭受伤害，请优先联系现实中的支持，不要独自等待这个页面的回应。</p>
      <div className="help-box"><strong>有紧急人身危险或医疗急症</strong><p>中国大陆可拨打 <a href="tel:110">110</a>（报警）或 <a href="tel:120">120</a>（医疗急救）。不在中国大陆时，请联系当地紧急服务。</p></div>
      <div className="help-box"><strong>需要心理援助与支持</strong><p>中国大陆可拨打全国统一心理援助热线 <a href="tel:12356">12356</a>。如果暂时无法接通，请联系当地医疗机构或可信任的成年人。</p></div>
      <div className="help-box"><strong>找一个安全、可信任的人陪你</strong><p>可以是老师、朋友、家人或专业人员。如果某个人让你不安全，就选择其他人。可以直接说：“我现在不太安全，需要你陪我一起找帮助。”</p></div><p className="modal-hint">本页是资源展示，没有真人值守，也不会自动拨号、定位或通知任何人。</p>
    </Modal>}
    {screen === 'privacy' && <Modal key={screen} label="YOUR DATA · 数据说明" title="关于你的小岛记录" onClose={close} actions={<><button className="secondary" onClick={() => setScreen('clear')}>清空所有本地记录</button><button className="primary" onClick={close}>我知道了</button></>}>
      <div className="privacy-copy"><p>签到、普通练习和复盘只保存在当前浏览器，不会上传或跨设备同步。带“示例”标签的记录是模拟数据。</p><p>在 AI 情境练习中，随心聊和 AI 情境练习会将你主动发送的文字及必要的近期对话提交给服务器配置的模型服务。随心聊仅在当前页面保留，刷新或清空对话后消失。API Key 只保存在服务端，不会发送到浏览器。</p><p>本地存储没有加密；使用同一浏览器的人可能看到这些记录。请使用虚构内容体验。你可以在“我的记录”中逐条删除，或在这里清空全部记录。</p></div>
    </Modal>}
    {(screen === 'delete' || screen === 'clear') && <Modal key={screen} label="YOUR DATA · 删除记录" title={screen === 'delete' ? '删除这条记录？' : '清空所有本地记录？'} onClose={close} actions={<><button className="secondary" onClick={() => screen === 'delete' ? close() : setScreen('privacy')}>{screen === 'delete' ? '保留' : '返回'}</button><button className="primary" onClick={() => { const saved = persist(screen === 'delete' ? records.filter(r => r.id !== deleteId) : []); close(); if (saved) setMessage('本地记录已删除'); }}>{screen === 'delete' ? '确认删除' : '确认清空'}</button></>}><p className="intro">{screen === 'delete' ? '删除后无法恢复，其他记录不会受到影响。' : '包括示例、签到和练习记录，删除后无法恢复。'}</p></Modal>}
    <div id="toast" className={message ? 'toast-visible' : ''} role="status" aria-live="polite">{message}</div>
  </>;
}
