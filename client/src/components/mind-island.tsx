'use client';

import Image from 'next/image';
import { useEffect, useState, type CSSProperties } from 'react';
import { exercises, moods, newRecord, readRecords, recommendation, needsSupport, storageKey, type Exercise, type ExerciseId, type PracticeRecord } from '@/lib/model';
import { api, type Account } from '@/lib/api';
import { useConversations, ConversationList, MobileConversationControls, ConversationDialogs, type ConversationSnapshot } from './chat-conversations';
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
const navigation: { id: View; title: string; icon: string }[] = [
  { id: 'chat', title: '随心聊', icon: 'message' },
  { id: 'courses', title: '课程', icon: 'book' },
  { id: 'today', title: '今日空间', icon: 'grid' },
  { id: 'exercises', title: '练习室', icon: 'leaf' },
  { id: 'records', title: '我的记录', icon: 'book' },
];
const categoryCopy: Record<string, string> = {
  '参与': '把注意力放回正在做的事，从普通的小行动开始。',
  '观察': '看见身体、想法和冲动，不急着追赶或改变。',
  '智慧心': '让感受和事实都被听见，再找适合自己的下一步。',
  '描述': '用具体的语言说清发生了什么，减少猜测和评判。',
};
const exerciseArtwork: Record<ExerciseId, string> = {
  'participate-guide': 'focus', 'participate-activity': 'focus', 'participate-immersion': 'focus',
  'participate-senses': 'body', 'participate-counter': 'labels', 'participate-rating': 'balance', 'participate-daily': 'focus',
  'observe-guide': 'clouds', 'observe-clouds': 'clouds', 'observe-body': 'body', 'observe-labels': 'labels',
  'observe-urge': 'wave', 'observe-counter': 'clouds', 'observe-daily': 'clouds',
  'wise-guide': 'balance', 'wise-decision': 'balance', 'wise-minds': 'balance', 'wise-breathing': 'body',
  'wise-friend': 'letter', 'wise-integration': 'balance', 'wise-quick': 'body',
  'describe-guide': 'facts', 'describe-facts': 'facts', 'describe-rewrite': 'facts', 'describe-body': 'body',
  'describe-scenario': 'letter', 'describe-daily': 'facts',
};
export default function MindIsland({ user, onLogout }: { user: Account; onLogout: () => Promise<void> }) {
  const [snapshot, setSnapshot] = useState<{ records: PracticeRecord[]; chat: ConversationSnapshot } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    Promise.all([api<{ records: PracticeRecord[] }>('/api/records'), api<ConversationSnapshot>('/api/chat/conversations')])
      .then(([records, chat]) => { if (active) setSnapshot({ records: records.records, chat }); })
      .catch(() => { if (active) setError('暂时无法读取服务器数据，请重新登录或重试。'); });
    return () => { active = false; };
  }, []);
  if (!snapshot) return <main className="account-page"><div role="status">{error || '正在打开你的小岛…'}{error && <button className="primary" onClick={() => location.reload()}>重新连接</button>}</div></main>;
  return <Workspace user={user} onLogout={onLogout} initialRecords={snapshot.records} initialChat={snapshot.chat} />;
}

function ScenarioCard({ onStart }: { onStart: () => void }) {
  return <section className="scenario-card">
    <div className="scenario-card-icon"><Icon name="message" /></div>
    <div><span className="scenario-kicker">AI 情境练习 · 3 轮</span><h2>练习向同学表达边界</h2><p>在一个安全、有限的模拟场景里，说清自己的感受和希望。</p></div>
    <button className="primary" onClick={onStart}>进入情境 <span>↗</span></button>
  </section>;
}

function ExerciseCard({ exercise, onStart, library = false }: { exercise: Exercise; onStart: (id: ExerciseId) => void; library?: boolean }) {
  if (library) {
    const artwork = exerciseArtwork[exercise.id];
    return <article className={`exercise-card practice-tile art-${artwork}`}>
      <button className="practice-tile-action" data-exercise={exercise.id} aria-label={`开始${exercise.title}`} onClick={() => onStart(exercise.id)}>
        <span className="practice-tile-art" data-artwork={artwork}><Image src={`/practice-art/${artwork}.webp`} alt="" width={720} height={720} sizes="(max-width: 640px) 44vw, (max-width: 1100px) 28vw, 220px" /></span>
        <span className="practice-tile-copy">
          <span className="practice-tile-meta"><span className="category">{exercise.kind === 'guide' ? '技能讲解' : exercise.category}</span><span className="duration"><Icon name="clock" />{exercise.time}</span></span>
          <span className="practice-tile-title">{exercise.title}</span>
          <span className="practice-tile-description">{exercise.subtitle}</span>
          <span className="practice-tile-cta">{exercise.kind === 'guide' ? '先了解' : '开始练习'} <span aria-hidden="true">→</span></span>
        </span>
      </button>
    </article>;
  }
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

function Workspace({ user, onLogout, initialRecords, initialChat }: { user: Account; onLogout: () => Promise<void>; initialRecords: PracticeRecord[]; initialChat: ConversationSnapshot }) {
  const chat = useConversations(initialChat);
  const [records, setRecords] = useState(initialRecords);
  const [showOnboarding, setShowOnboarding] = useState(!user.onboarded);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
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
  const [exerciseId, setExerciseId] = useState<ExerciseId>('observe-body');
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

  async function saveRecord(record: PracticeRecord) {
    try { const data = await api<{ records: PracticeRecord[] }>('/api/records', 'POST', { record }); setRecords(data.records); return true; }
    catch { setMessage('服务器未能保存，请保留内容并重试'); return false; }
  }
  async function acceptOnboarding() {
    try { await api('/api/account', 'PATCH', { onboarded: true }); setShowOnboarding(false); }
    catch { setMessage('服务器未能保存确认，请重试'); }
  }
  async function completeScenario(summary: string) {
    if (!await saveRecord(newRecord({ kind: 'exercise', title: '表达边界情境练习', note: summary, helpful: '完成情境练习' }))) return false;
    setScreen(null); setMessage('情境练习已保存到我的记录');
    return true;
  }
  async function importLegacy() {
    setImporting(true);
    try {
      const legacy = readRecords(localStorage.getItem(storageKey)).filter(record => !record.demo);
      if (!legacy.length) { setMessage('没有可导入的旧版个人记录'); return; }
      const data = await api<{ records: PracticeRecord[] }>('/api/records/import', 'POST', { records: legacy });
      setRecords(data.records);
      localStorage.removeItem(storageKey);
      localStorage.removeItem('mind-island-onboarding-v2');
      setMessage('旧版个人记录已导入当前账户，浏览器副本已移除');
    } catch { setMessage('导入未完成，请重试；重复导入不会生成重复记录'); }
    finally { setImporting(false); }
  }
  async function removeRecords() {
    if (saving) return; setSaving(true);
    try { const data = await api<{ records: PracticeRecord[] }>(screen === 'delete' ? `/api/records/${encodeURIComponent(deleteId)}` : '/api/records', 'DELETE'); setRecords(data.records); close(); setMessage('服务器记录已删除'); }
    catch { setMessage('服务器未能删除，请重试'); }
    finally { setSaving(false); }
  }
  function navigate(next: View) { setView(next); window.scrollTo({ top: 0 }); }
  function checkin(selected = '') { setMood(selected); setIntensity(5); setNote(''); setScreen('checkin'); }
  function start(id: ExerciseId, initial = 5) {
    setExerciseId(id); setBefore(initial); setScreen('training');
  }
  async function saveCheckin() {
    if (saving) return;
    if (needsSupport(note)) { setScreen('help'); return; }
    setSaving(true);
    const saved = await saveRecord(newRecord({ kind: 'checkin', title: '情绪签到', mood: moods.find(m => m.id === mood)?.label || '未选择', before: intensity, note: note.trim() }));
    setSaving(false); if (!saved) return;
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
        <div className="conversation-desktop" hidden={view !== 'chat'}><ConversationList chat={chat} /></div>
        <SidebarReminder />
        <div className="sidebar-bottom"><button className="support-link" onClick={() => setScreen('help')}><Icon name="lifebuoy" />我需要一些帮助 <span>↗</span></button><div className="profile"><div className="avatar">{user.name.slice(0, 1)}</div><div>{user.name}<small>今天也在慢慢成长</small></div><span className="profile-spark">✧</span></div></div>
      </aside>
      <main>
        <header className="topbar"><div><span className="breadcrumb">我的小岛</span><span className="slash">/</span><span id="page-crumb">{navigation.find(n => n.id === view)?.title}</span></div><div className="topbar-right"><span className={`demo-badge ${aiStatus}`}><i />{aiStatus === 'configured' ? 'AI 已配置' : aiStatus === 'checking' ? '正在检查 AI' : '预设模式'}</span><button className="icon-button" aria-label="寻求帮助" title="寻求帮助" onClick={() => setScreen('help')}><Icon name="lifebuoy" /></button><button className="icon-button" aria-label="账户数据说明" onClick={() => setScreen('privacy')}><Icon name="shield" /></button><button className="text-button logout-button" onClick={() => { void onLogout().catch(() => setMessage('暂时无法退出，请重试')); }}>退出登录</button></div></header>
        <div id="page" className={`page${view === 'exercises' ? ' practice-library-page' : ''}`}>
          <div className="eyebrow">{headings[0]}</div><div className="welcome"><div><h1>{headings[1]}<span aria-hidden="true">✧</span></h1><p>{headings[2]}</p></div>{view === 'today' && <div className="date-pill"><Icon name="calendar" />{now.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}</div>}</div>
          {view === 'chat' && <MobileConversationControls chat={chat} />}
          <div className="chat-view" hidden={view !== 'chat'} aria-busy={chat.busy}><CompanionChat key={chat.current.id} active={view === 'chat'} switching={chat.busy} model={aiModel} conversationId={chat.current.id} initialMessages={chat.current.messages} initialDraft={chat.draft} onDraftChange={chat.updateDraft} onBusyChange={chat.setChatBusy} onHistorySaved={chat.saved} onHandoff={() => setScreen('help')} onSave={saveRecord} /></div>
          {view === 'courses' && <Courses onPractice={() => navigate('exercises')} />}
          {view === 'today' && <>
            <div className="hero-grid"><section className="hero"><div className="hero-copy"><span className="hero-label">TAKE A BREATH</span><h2>不用急着找到答案，<br />先照顾此刻的自己。</h2><p>从一次情绪签到开始，<br />找到今天适合你的那一小步。</p><button className="primary" onClick={() => checkin()}>开始情绪签到 <span>↗</span></button></div><Image className="hero-art" src="/island-garden.svg" alt="" width={310} height={265} priority /></section>
              <section className="week-card"><div className="card-heading">本周的小脚印<span className="tiny-pill">近 7 天</span></div><div className="week-number">{completed}<span>次用心练习</span></div><div className="week-bars">{Array.from({ length: 7 }, (_, i) => {
                const day = new Date(now); day.setDate(day.getDate() - 6 + i);
                const count = records.filter(r => new Date(r.date).toDateString() === day.toDateString()).length;
                return <div className="day" key={i}><i style={{ '--height': `${Math.min(43, 7 + count * 18)}px` } as CSSProperties} /><span>{['日', '一', '二', '三', '四', '五', '六'][day.getDay()]}</span></div>;
              })}</div><p>每一次停下来，都是在照顾自己。<br />{records.some(r => r.demo) ? '含示例记录' : '来自你的记录'}</p></section>
            </div>
            <section><div className="section-heading"><div><h2>今天，想从哪里开始？</h2><p>从参与、观察、智慧心和描述中，选一个适合此刻的练习</p></div><button className="text-button" onClick={() => navigate('exercises')}>探索练习室 <span>↗</span></button></div><div className="exercise-grid">{['observe-body', 'describe-facts', 'participate-activity'].map(id => exercises.find(ex => ex.id === id)!).map(ex => <ExerciseCard key={ex.id} exercise={ex} onStart={start} />)}</div></section>
            <ScenarioCard onStart={() => setScreen('scenario')} />
            <div className="bottom-grid"><section className="checkin-card"><div className="small-heading"><h2>此刻的心情，像哪一种？</h2><span>没有标准答案</span></div><MoodButtons onSelect={checkin} /></section><section className="recent-card"><div className="small-heading"><h2>最近的小小进展</h2><button className="text-button" onClick={() => navigate('records')}>查看全部 ↗</button></div>{records.slice(0, 2).map(r => <Recent key={r.id} record={r} />)}{records.length === 0 && <p className="no-records">你的第一条记录，会从这里开始。</p>}</section></div>
          </>}
          {view === 'exercises' && <>
            <section className="practice-spotlight" aria-labelledby="practice-spotlight-title">
              <div className="practice-spotlight-copy"><span>为此刻选一个练习</span><h2 id="practice-spotlight-title">想法太快时，先听听身体</h2><p>不分析原因，只留意胸口、肩膀或呼吸有什么感觉。两分钟，按自己的节奏来。</p><button className="spotlight-action" data-featured-exercise="observe-body" onClick={() => start('observe-body')}>开始身体感觉观察 <span aria-hidden="true">→</span></button></div>
              <Image className="practice-spotlight-art" src="/practice-art/body.webp" alt="" width={720} height={720} priority sizes="(max-width: 640px) 46vw, 360px" />
            </section>
            <ScenarioCard onStart={() => setScreen('scenario')} />
            <section className="practice-catalog" aria-labelledby="practice-catalog-title">
              <div className="practice-catalog-heading"><div><span>探索练习</span><h2 id="practice-catalog-title">今天想练习什么？</h2></div><p>先选一个方向。每个练习都可以暂停，也不需要做到完美。</p></div>
              <div className="filters" aria-label="练习分类">{['全部', ...exerciseCategories].map(f => <button key={f} className={`filter ${filter === f ? 'active' : ''}`} aria-pressed={filter === f} onClick={() => setFilter(f)}>{f}</button>)}</div>
              <div className="practice-category-list">{exerciseCategories.filter(category => filter === '全部' || category === filter).map(category => <section className="practice-category" key={category} data-category={category} aria-labelledby={`practice-category-${category}`}>
                <div className="practice-category-heading"><div><h3 id={`practice-category-${category}`}>{category}</h3><p>{categoryCopy[category]}</p></div><span>{exercises.filter(ex => ex.category === category).length} 个</span></div>
                <div className="exercise-grid">{exercises.filter(ex => ex.category === category).map(ex => <ExerciseCard key={ex.id} exercise={ex} onStart={start} library />)}</div>
              </section>)}</div>
            </section>
            <div className="library-intro"><strong>练习不是考试</strong><span>你可以随时暂停或跳过。目的不是消除所有情绪，而是多一种照顾自己的方式。</span></div>
          </>}
          {view === 'records' && <>
            <div className="filters">{['全部', '情绪签到', '练习复盘'].map(f => <button key={f} className={`filter ${recordFilter === f ? 'active' : ''}`} aria-pressed={recordFilter === f} onClick={() => setRecordFilter(f)}>{f}</button>)}</div>
            <p className="eyebrow">保存在你的账户 · 登录同一账户可跨设备查看 · 可随时删除</p><button className="text-button" disabled={importing} onClick={importLegacy}>导入此浏览器的旧版个人记录</button>
            <div className="record-list">{visible.map(r => <article className="full-record" key={r.id}><Recent record={r} onDelete={id => { setDeleteId(id); setScreen('delete'); }} /><p>{r.note}</p></article>)}{visible.length === 0 && <div className="empty"><h2>这里还没有记录</h2><p>从一次小小的签到，认识此刻的自己。</p><button className="primary" onClick={() => checkin()}>开始情绪签到 ↗</button></div>}</div>
          </>}
        </div>
        <footer>每一种情绪，都值得被看见。<span>心理健康技能练习 · 不提供诊断或治疗</span></footer>
      </main>
    </div>

    <ConversationDialogs chat={chat} />
    {showOnboarding && <Onboarding onAccept={acceptOnboarding} />}
    {screen === 'scenario' && <ScenarioPractice onClose={close} onComplete={completeScenario} onHandoff={() => setScreen('help')} />}

    {screen === 'checkin' && <Modal key={screen} label="EMOTIONAL CHECK-IN · 情绪签到" title="先听听此刻的自己" onClose={close} actions={<><button className="secondary" onClick={close}>暂时不记录</button><button className="primary" disabled={saving} onClick={saveCheckin}>记录此刻，看看推荐 ↗</button></>}>
      <p className="intro">用你舒服的方式记录。不想填写的内容，可以留空。</p><MoodButtons selected={mood} onSelect={setMood} /><Intensity value={intensity} onChange={setIntensity} />
      <label className="field-label" htmlFor="note">发生了什么？<span>（选填）</span></label><textarea id="note" maxLength={500} value={note} onChange={e => setNote(e.target.value)} placeholder="比如：想到明天的考试，心里有一点紧张……" />
      <p className="modal-hint">保存到当前账户，授权管理员可管理记录。</p>
    </Modal>}
    {screen === 'recommendation' && <Modal key={screen} label="A MOMENT FOR YOU · 已记录" title="谢谢你，愿意照顾自己" onClose={close} actions={<><button className="secondary" onClick={() => { close(); navigate('exercises'); }}>自己选一个</button><button className="primary" onClick={() => start(exerciseId, before)}>试试这个练习 ↗</button></>}>
      <div className="success-icon">✓</div><p className="intro">{before >= 4 ? '先把分析和计划放一放。可以试着把注意力带回身边。' : '如果你愿意，可以为接下来选一个轻松的小行动。'}</p><div className="summary">推荐练习：{exercise.title}<br />{exercise.description}</div><p className="modal-hint">这是预设规则生成的推荐，不是心理评估。你也可以选择其他练习。</p>
    </Modal>}
    {screen === 'training' && <TrainingSession exerciseId={exerciseId} initialIntensity={before} onClose={close} onHandoff={() => setScreen('help')} onSave={saveRecord} onRecords={() => { close(); setRecordFilter('全部'); navigate('records'); }} />}
    {screen === 'help' && <Modal key={screen} label="REAL-WORLD SUPPORT · 现实中的支持" title="你可以寻求身边的帮助" onClose={close} actions={<button className="secondary" onClick={close}>关闭帮助页</button>}>
      <p className="intro">如果你现在可能伤害自己或他人，或正在遭受伤害，请优先联系现实中的支持，不要独自等待这个页面的回应。</p>
      <div className="help-box"><strong>有紧急人身危险或医疗急症</strong><p>中国大陆可拨打 <a href="tel:110">110</a>（报警）或 <a href="tel:120">120</a>（医疗急救）。不在中国大陆时，请联系当地紧急服务。</p></div>
      <div className="help-box"><strong>需要心理援助与支持</strong><p>中国大陆可拨打全国统一心理援助热线 <a href="tel:12356">12356</a>。如果暂时无法接通，请联系当地医疗机构或可信任的成年人。</p></div>
      <div className="help-box"><strong>找一个安全、可信任的人陪你</strong><p>可以是老师、朋友、家人或专业人员。如果某个人让你不安全，就选择其他人。可以直接说：“我现在不太安全，需要你陪我一起找帮助。”</p></div><p className="modal-hint">本页是资源展示，没有真人值守，也不会自动拨号、定位或通知任何人。</p>
    </Modal>}
    {screen === 'privacy' && <Modal key={screen} label="YOUR DATA · 数据说明" title="关于你的小岛记录" onClose={close} actions={<><button className="secondary" onClick={() => setScreen('clear')}>清空所有账户记录</button><button className="primary" onClick={close}>我知道了</button></>}>
      <div className="privacy-copy"><p>签到、练习复盘、随心聊、AI 情境练习对话和使用说明确认状态均保存在服务器。登录同一账户可以跨设备读取记录和随心聊对话。授权管理员可查看、删除数据及停用账户。</p><p>随心聊和 AI 情境练习会将你主动发送的文字及必要的近期对话提交给服务器配置的模型服务。API Key 只保存在服务端。浏览器仅保留用于登录的 HttpOnly 会话 Cookie。</p><p>可逐条删除或清空当前账户练习记录；随心聊对话可在聊天页单独清空。旧版本地记录只会在你主动导入并成功保存后移除浏览器副本。</p></div>
    </Modal>}
    {(screen === 'delete' || screen === 'clear') && <Modal key={screen} label="YOUR DATA · 删除记录" title={screen === 'delete' ? '删除这条记录？' : '清空所有账户记录？'} onClose={close} actions={<><button className="secondary" onClick={() => screen === 'delete' ? close() : setScreen('privacy')}>{screen === 'delete' ? '保留' : '返回'}</button><button className="primary" disabled={saving} onClick={removeRecords}>{screen === 'delete' ? '确认删除' : '确认清空'}</button></>}><p className="intro">{screen === 'delete' ? '删除后无法恢复，其他记录不会受到影响。' : '清空当前账户的签到和练习记录，删除后无法恢复。对话需在聊天页单独清空。'}</p></Modal>}
    <div id="toast" className={message ? 'toast-visible' : ''} role="status" aria-live="polite">{message}</div>
  </>;
}
