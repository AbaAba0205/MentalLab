import { moods, exercises, recommendation, needsSupport, newRecord, readRecords, seedRecords } from './model.js';

const paths = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  leaf: '<path d="M20 3C7 2 2 7 5 14c3 7 16 5 15-11Z"/><path d="m4 21 11-12M8 16l-1-5m5 1 5 1"/>',
  book: '<path d="M12 6C8 3 4 4 2 5v15c4-2 7-1 10 1 3-2 6-3 10-1V5c-3-1-6-2-10 1Zm0 0v15"/>',
  shield: '<path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6l8-4Z"/><path d="m8 11 3 3 5-6"/>',
  lifebuoy: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="m6 6 3 3m6 6 3 3M6 18l3-3m6-6 3-3"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-13 5h3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  flower: '<path d="M12 20C3 21 1 15 3 12c5-1 9 3 9 8Zm0 0c9 1 11-5 9-8-5-1-9 3-9 8Z" fill="currentColor" opacity=".35"/><path d="M12 16C4 10 8 4 12 2c4 2 8 8 0 14Z" fill="currentColor" opacity=".6"/><path d="M4 21h16"/>',
  cloud: '<path d="M5 17a5 5 0 0 1-1-10 7 7 0 0 1 13-1 5.5 5.5 0 0 1 1 11H5Z" fill="currentColor" opacity=".4"/><path d="M7 20h9m-6 3h3"/>',
  sun: '<circle cx="12" cy="12" r="5" fill="currentColor" opacity=".5"/><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.leaf}</svg>`;
document.querySelectorAll('[data-icon]').forEach(el => el.innerHTML = icon(el.dataset.icon));
const $ = s => document.querySelector(s);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const storageKey = 'mind-island-demo-v1';
let records;
try { const raw = localStorage.getItem(storageKey); records = raw === null ? seedRecords() : readRecords(raw); } catch { records = seedRecords(); }
let currentView = 'today', filter = '全部', recordFilter = '全部', timer = null, remaining = 30, workflow = null;
const dialog = $('#dialog');
function save() { try { localStorage.setItem(storageKey, JSON.stringify(records)); return true; } catch { toast('浏览器未允许保存，记录仅在当前页面保留'); return false; } }
function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('toast-visible'); clearTimeout(toast.timeout); toast.timeout = setTimeout(() => $('#toast').classList.remove('toast-visible'), 3200); }
const art = `<svg class="hero-art" viewBox="0 0 310 265" style="stroke:none" aria-hidden="true"><defs><linearGradient id="hill" x2="0" y2="1"><stop stop-color="#c3b7df"/><stop offset="1" stop-color="#a89bc9"/></linearGradient><linearGradient id="hill2" x2="0" y2="1"><stop stop-color="#b4d2d6"/><stop offset="1" stop-color="#91b9c4"/></linearGradient><linearGradient id="rock" x2="0.8" y2="1"><stop stop-color="#e5d8e7"/><stop offset="1" stop-color="#b2a1c4"/></linearGradient></defs><circle cx="205" cy="66" r="32" fill="#fbf2dd" opacity=".8"/><path d="M133 66h36c10 0 9-10 1-11-2-13-24-13-27-1-14-2-16 12-10 12Z" fill="#fff" opacity=".48"/><path d="M260 112h35c12 0 12-10 1-10-4-14-21-11-24-2-13-4-18 12-12 12Z" fill="#fff" opacity=".5"/><path d="M0 228C56 129 92 183 124 162s69-50 113-15 86 2 109 45v90H0" fill="#d2c9e6"/><path d="M-5 249c53-39 86-104 135-70s75 8 95 31 54-45 95-25v90H-5Z" fill="url(#hill)"/><path d="M-20 276c53-56 91-19 128-56s101-14 134 1 56-9 83-25v80Z" fill="url(#hill2)"/><ellipse cx="191" cy="244" rx="61" ry="9" fill="#6e799c" opacity=".15"/><path d="M155 228c-9-20 74-32 77-9 3 16-68 24-77 9Z" fill="url(#rock)"/><path d="M166 210c-9-21 61-24 56-5-3 14-50 16-56 5Z" fill="#d8c9df"/><path d="M173 192c-6-17 41-22 43-7s-39 20-43 7Z" fill="#e6dbe9"/><path d="M185 173c-10-11 17-20 21-9 5 12-16 17-21 9Z" fill="#eee7f0"/><path d="M267 240q-12-39-1-65m0 37q-20-1-18-20 17 4 18 20m0-18q20-6 22-22-19 0-22 22m-2 36q-24 1-21-16 19 1 21 16" stroke="#698f93" stroke-width="2" fill="#8bb0b1"/><path d="m119 100 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" fill="#fff" opacity=".6"/><circle cx="263" cy="57" r="2" fill="#af9cc7"/></svg>`;
function card(ex) { return `<article class="exercise-card ${ex.color}"><div class="exercise-top"><div class="exercise-icon">${icon(ex.icon)}</div><span class="duration">${icon('clock')}${ex.time}</span></div><h3>${ex.title}</h3><p>${ex.subtitle}</p><div class="exercise-bottom"><span class="category">${ex.category}</span><button class="round-arrow" data-exercise="${ex.id}" aria-label="开始${ex.title}">↗</button></div></article>`; }
function moodButtons(selected = '') { return moods.map(m => `<button class="mood ${selected === m.id ? 'selected' : ''}" data-mood="${m.id}" aria-pressed="${selected === m.id}"><span class="face" style="--face:${m.color}">${m.face}</span>${m.label}</button>`).join(''); }
function dateText(date) { return new Date(date).toLocaleDateString('zh-CN', { month:'long', day:'numeric' }); }
function recent(r, full = false) { return `<div class="recent-row"><span class="record-symbol">${icon(r.kind === 'exercise' ? 'flower' : 'book')}</span><div><h3>${escape(r.title)}${r.demo ? ' <span class="tiny-pill">示例</span>' : ''}</h3><p>${dateText(r.date)} · ${escape(r.kind === 'exercise' ? r.helpful || '完成一次练习' : r.mood || '记录了此刻')}</p></div>${full ? `<div class="record-actions"><span class="record-end">${r.after != null ? `${r.before ?? '—'} → ${r.after} <small>/ 10</small>` : ''}</span><button class="delete-button" data-delete="${escape(r.id)}" aria-label="删除${escape(r.title)}记录">删除</button></div>` : `<span class="record-end">${r.after != null ? `${r.before ?? '—'} → ${r.after} <small>/ 10</small>` : '已记录'}</span>`}</div>`; }
function render() {
  document.querySelectorAll('[data-view]').forEach(b => { b.classList.toggle('active', b.dataset.view === currentView); if(b.dataset.view === currentView) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current'); });
  $('#page-crumb').textContent = { today:'今日空间', exercises:'练习室', records:'我的记录' }[currentView];
  const heading = currentView === 'today' ? `<div class="eyebrow">A LITTLE SPACE, JUST FOR YOU</div><div class="welcome"><div><h1>嗨，今天的你还好吗？<span>✧</span></h1><p>在这里，放慢一点，听听自己的声音。</p></div><div class="date-pill">${icon('calendar')}${new Date().toLocaleDateString('zh-CN', {month:'long',day:'numeric',weekday:'long'})}</div></div>` : `<div class="eyebrow">${currentView === 'exercises' ? 'SMALL PRACTICES, GENTLE CHANGES' : 'EVERY LITTLE STEP COUNTS'}</div><div class="welcome"><div><h1>${currentView === 'exercises' ? '给自己一点练习的时间' : '每一小步，都在这里'}<span>✧</span></h1><p>${currentView === 'exercises' ? '不必做得完美，选一个现在适合你的练习。' : '记录感受，也记住那些愿意照顾自己的时刻。'}</p></div></div>`;
  if (currentView === 'today') {
    const completed = records.filter(r => r.kind === 'exercise' && Date.now() - Date.parse(r.date) < 7 * 86400000).length;
    const bars = Array.from({length:7}, (_,i) => { const day = new Date(); day.setDate(day.getDate()-6+i); const count = records.filter(r=> new Date(r.date).toDateString()===day.toDateString()).length; return `<div class="day"><i style="--height:${Math.min(43, 7 + count*18)}px"></i><span>${['日','一','二','三','四','五','六'][day.getDay()]}</span></div>`; }).join('');
    $('#page').innerHTML = heading + `<div class="hero-grid"><section class="hero"><div class="hero-copy"><span class="hero-label">TAKE A BREATH</span><h2>不用急着找到答案，<br>先照顾此刻的自己。</h2><p>从一次情绪签到开始，<br>找到今天适合你的那一小步。</p><button class="primary" data-action="checkin">开始情绪签到 <span>↗</span></button></div>${art}</section><section class="week-card"><div class="card-heading">本周的小脚印<span class="tiny-pill">近 7 天</span></div><div class="week-number">${completed}<span>次用心练习</span></div><div class="week-bars">${bars}</div><p>每一次停下来，都是在照顾自己。<br>含示例记录</p></section></div><section><div class="section-heading"><div><h2>今天，想从哪里开始？</h2><p>为考试前的你，准备了三个小练习</p></div><button class="text-button" data-view="exercises">探索练习室 <span>↗</span></button></div><div class="exercise-grid">${exercises.map(card).join('')}</div></section><div class="bottom-grid"><section class="checkin-card"><div class="small-heading"><h2>此刻的心情，像哪一种？</h2><span>没有标准答案</span></div><div class="moods">${moodButtons()}</div></section><section class="recent-card"><div class="small-heading"><h2>最近的小小进展</h2><button class="text-button" data-view="records">查看全部 ↗</button></div>${records.slice(0,2).map(r=>recent(r)).join('') || '<p class="no-records">你的第一条记录，会从这里开始。</p>'}</section></div>`;
  } else if(currentView === 'exercises') {
    $('#page').innerHTML = heading + `<div class="filters" aria-label="练习分类">${['全部','情绪调节','想法整理','行动计划'].map(f=>`<button class="filter ${filter===f?'active':''}" data-filter="${f}" aria-pressed="${filter===f}">${f}</button>`).join('')}</div><div class="exercise-grid">${exercises.filter(e=>filter==='全部'||e.category===filter).map(card).join('')}</div><div class="library-intro">✧ &nbsp; 你可以随时暂停或跳过。练习的目的不是消除所有情绪，而是多一种照顾自己的方式。</div>`;
  } else {
    const visible = records.filter(r=>recordFilter==='全部'||r.kind===(recordFilter==='练习复盘'?'exercise':'checkin'));
    $('#page').innerHTML = heading + `<div class="filters">${['全部','情绪签到','练习复盘'].map(f=>`<button class="filter ${recordFilter===f?'active':''}" data-record-filter="${f}" aria-pressed="${recordFilter===f}">${f}</button>`).join('')}</div><p class="eyebrow">保存在当前浏览器 · 可随时删除 · 带“示例”的记录为模拟数据</p><div class="record-list">${visible.map(r=>`<article class="full-record">${recent(r,true)}<p>${escape(r.note)}</p></article>`).join('') || '<div class="empty"><h2>这里还没有记录</h2><p>从一次小小的签到，认识此刻的自己。</p><button class="primary" data-action="checkin">开始情绪签到 ↗</button></div>'}</div>`;
  }
}
function modal(label, title, content, actions = '') { $('#dialog-content').innerHTML = `<div class="modal"><div class="modal-top"><span class="modal-label">${label}</span><button class="close-button" data-action="close" aria-label="关闭">×</button></div><h2 id="dialog-title">${title}</h2>${content}${actions ? `<div class="modal-actions">${actions}</div>` : ''}</div>`; if(!dialog.open) dialog.showModal(); }
function stopTimer() { clearInterval(timer); timer = null; }
dialog.addEventListener('close', stopTimer);
function close() { stopTimer(); dialog.close(); workflow=null; }
function intensity(value=5, label='此刻的困扰有多强烈？') { return `<label class="range-label" for="intensity">${label}<strong id="intensity-value">${value} <small>/ 10</small></strong></label><input id="intensity" type="range" min="0" max="10" value="${value}"><div class="range-ends"><span>0 · 没有困扰</span><span>10 · 很难承受</span></div>`; }
function checkin(mood='') { workflow={type:'checkin',mood}; modal('EMOTIONAL CHECK-IN · 情绪签到','先听听此刻的自己',`<p class="intro">用你舒服的方式记录。不想填写的内容，可以留空。</p><div class="moods">${moodButtons(mood)}</div>${intensity()}<label class="field-label" for="note">发生了什么？<span>（选填）</span></label><textarea id="note" maxlength="500" placeholder="比如：想到明天的考试，心里有一点紧张……"></textarea><p class="modal-hint">仅保存于当前浏览器。演示时建议使用虚构内容。</p>`,`<button class="secondary" data-action="close">暂时不记录</button><button class="primary" data-action="save-checkin">记录此刻，看看推荐 ↗</button>`); }
function saveCheckin() {
  const before=Number($('#intensity').value),note=$('#note').value.trim();
  if(needsSupport(note)) { help(); return; }
  const mood=moods.find(m=>m.id===workflow.mood)?.label||'未选择';
  records.unshift(newRecord({kind:'checkin',title:'情绪签到',mood,before,note}));save();render();
  const ex=exercises.find(e=>e.id===recommendation(before));workflow={before};
  modal('A MOMENT FOR YOU · 已记录','谢谢你，愿意照顾自己',`<div class="success-icon">✓</div><p class="intro">${before>=7?'先把分析和计划放一放。可以试着把注意力带回身边。':before>=4?'如果你愿意，可以一起整理那个让你挂心的念头。':'如果你愿意，可以为接下来选一个轻松的小行动。'}</p><div class="summary">推荐练习：${ex.title}<br>${ex.description}</div><p class="modal-hint">这是预设规则生成的演示推荐，不是心理评估。你也可以选择其他练习。</p>`,`<button class="secondary" data-action="browse">自己选一个</button><button class="primary" data-exercise="${ex.id}" data-before="${before}">试试这个练习 ↗</button>`);
}
const steps = {
  ground: [
    {title:'找一个舒服的位置',intro:'可以坐着，也可以站着。睁着眼睛，让双脚轻轻接触地面。',prompt:'留意脚底与地面接触的感觉。不需要改变它，只要注意到就好。'},
    {title:'看看你身边的世界',intro:'慢慢找出三个你能看到的东西，在心里说出它们的颜色或形状。',prompt:'一扇窗、一张桌子、一片叶子……普通的小东西也可以。',timer:true},
    {title:'把注意力带回这里',intro:'找出一个你能听到的声音，再留意身体与椅子或地面的接触。',prompt:'按自己舒服的节奏呼吸。想走神也没关系，注意到后再轻轻回来。'}
  ],
  thought: [
    {title:'先把事情和想法分开',intro:'只写发生的事，再写脑海里的担心。不必急着判断对错。',placeholder:'比如：明天有数学考试。我担心考不好，就证明自己很差。'},
    {title:'给另一种可能留点空间',intro:'有哪些你知道的事实？有没有事实让这个担心没那么绝对？如果不知道，也可以这样写。',placeholder:'比如：上一次有几道题不会，但也完成了不少题。一次考试不能说明全部。'},
    {title:'写一句你真正相信的话',intro:'不用强迫自己积极。试着写一句既承认困难，也给自己留点空间的话。',placeholder:'比如：我很在乎这次考试。我可以认真准备，也允许自己有不会的题。'}
  ],
  plan: [
    {title:'选一个刚刚好的小行动',intro:'你不需要一次解决所有问题。选一个现在愿意尝试的就好。',choices:['整理明天的考试用品','为复习留一个结束时间','写下一个想问老师的问题','做一点让身体舒服的小事']},
    {title:'让这一步更容易开始',intro:'什么时候、在哪里做？尽量具体，也可以把任务再缩小一点。',placeholder:'比如：今晚吃完饭，在书桌前把笔和准考证放进包里。'},
    {title:'给计划留一点弹性',intro:'如果到时候没有做到，你愿意怎样调整？不需要惩罚自己。',placeholder:'比如：如果太累，就先把笔放进去。剩下的明早再检查。'}
  ]
};
function startExercise(id,before) { stopTimer();workflow={type:'exercise',id,step:-1,before:before==null?5:Number(before),answers:[],choice:''}; const ex=exercises.find(e=>e.id===id); modal('YOUR LITTLE PRACTICE · '+ex.time,ex.title,`<p class="intro">${ex.description}你可以随时退出，感到不舒服时就停下来。</p>${intensity(workflow.before)}<p class="modal-hint">困扰强度仅用于自我观察，不代表诊断。需要现实支持时，可以随时打开帮助。</p>`,`<button class="secondary" data-action="help">我需要帮助</button><button class="primary" data-action="begin">我想试试 ↗</button>`); }
function showStep() {
  stopTimer(); const w=workflow,s=steps[w.id][w.step];remaining=30;
  modal(`GUIDED PRACTICE · ${exercises.find(e=>e.id===w.id).title}`,s.title,`<div class="progress-track"><i style="width:${(w.step+1)/4*100}%"></i></div><p class="intro">${s.intro}</p>${s.prompt?`<div class="practice-prompt">${s.prompt}</div>`:''}${s.placeholder?`<label class="field-label" for="answer">我的想法 <span>（可以留空）</span></label><textarea id="answer" maxlength="500" placeholder="${s.placeholder}">${escape(w.answers[w.step]||'')}</textarea>`:''}${s.choices?`<div class="choice-grid">${s.choices.map(c=>`<button class="choice ${w.choice===c?'selected':''}" data-choice="${c}" aria-pressed="${w.choice===c}">${c}</button>`).join('')}</div>`:''}${s.timer?'<div class="timer-ring"><strong id="timer-value">00:30</strong><small>给自己一点时间</small></div><div class="timer-controls"><button class="secondary" data-action="timer">开始计时</button><button class="text-button" data-action="reset-timer">重置</button></div>':''}`,`<button class="secondary" data-action="${w.step===0?'close':'previous'}">${w.step===0?'先到这里':'上一步'}</button><span class="step-count">${w.step+1} / 3</span><button class="primary" data-action="next">${w.step===2?'完成，去复盘':'下一步'} →</button>`);
}
function collect() { if($('#answer')) workflow.answers[workflow.step]=$('#answer').value.trim(); if(workflow.id==='plan'&&workflow.step===0) workflow.answers[0]=workflow.choice; }
function review() { stopTimer(); modal('A LITTLE REFLECTION · 练习复盘','现在，感觉怎么样？',`<p class="intro">情绪没有下降也没关系。愿意停下来照顾自己，就是这次练习的一部分。</p>${intensity(workflow.before,'此刻的困扰强度')}<label class="field-label">这次练习对你有帮助吗？</label><div class="choice-grid">${['有一点帮助','暂时没感觉','有点不舒服'].map(c=>`<button class="choice" data-feedback="${c}" aria-pressed="false">${c}</button>`).join('')}</div><label class="field-label" for="reflection">想给自己留下一句话吗？（选填）</label><textarea id="reflection" maxlength="500" placeholder="比如：下次紧张时，我想先停下来看看窗外。"></textarea>`,`<button class="secondary" data-action="back-practice">返回练习</button><button class="primary" data-action="save-exercise">保存这一步 ✓</button>`); }
function saveExercise() {
  const w=workflow,after=Number($('#intensity').value),reflection=$('#reflection').value.trim();
  if(needsSupport(reflection)) { help();return; }
  const parts=w.answers.filter(Boolean);if(reflection)parts.push(reflection);
  records.unshift(newRecord({kind:'exercise',title:exercises.find(e=>e.id===w.id).title,before:w.before,after,note:parts.join('\n'),helpful:w.helpful||'未评价'}));save();render();
  modal('WELL DONE · 一次小小的照顾','这一小步，已经记下了',`<div class="success-icon">✓</div><p class="intro">${w.helpful==='有点不舒服'?'先停止这个练习，做些让自己舒服的事。若不适持续，可以寻求现实中的支持。':'你不需要立刻变得更好。需要时，可以再回来，也可以向身边的人寻求支持。'}</p><div class="summary">${escape(exercises.find(e=>e.id===w.id).title)}<br>困扰强度：${w.before} → ${after} / 10<br>${escape(reflection || '给自己一点时间，也给自己一点空间。')}</div>`,`<button class="secondary" data-action="close">回到空间</button><button class="primary" data-action="view-records">看看我的记录 ↗</button>`);
}
function help() { stopTimer();modal('REAL-WORLD SUPPORT · 现实中的支持','你可以寻求身边的帮助',`<p class="intro">如果你现在可能伤害自己或他人，或正在遭受伤害，请优先联系现实中的支持，不要独自等待这个页面的回应。</p><div class="help-box"><strong>有紧急人身危险或医疗急症</strong><p>中国大陆可拨打 <a href="tel:110">110</a>（报警）或 <a href="tel:120">120</a>（医疗急救）。不在中国大陆时，请联系当地紧急服务。</p></div><div class="help-box"><strong>找一个安全、可信任的人陪你</strong><p>可以是老师、朋友、家人或专业人员。如果某个人让你不安全，就选择其他人。可以直接说：“我现在不太安全，需要你陪我一起找帮助。”</p></div><p class="modal-hint">本页是资源展示，没有真人值守，也不会自动拨号、定位或通知任何人。</p>`,`<button class="secondary" data-action="close">关闭帮助页</button>`); }
function privacy() { modal('YOUR DATA · 数据说明','这是一座演示小岛',`<div class="privacy-copy"><p>本 Demo 没有后端，也没有接入真实 AI。推荐和练习引导由预设规则生成。</p><p>签到、练习和复盘只保存在当前浏览器的本地存储中。带“示例”标签的记录是模拟数据。请使用虚构内容体验，不要录入真实敏感信息。</p><p>本地存储没有加密；使用同一浏览器的人可能看到这些记录。你可以在“我的记录”中逐条删除，或在这里清空全部记录。</p></div>`,`<button class="secondary" data-action="confirm-clear">清空所有本地记录</button><button class="primary" data-action="close">我知道了</button>`); }
document.addEventListener('input', e=>{ if(e.target.id==='intensity') $('#intensity-value').innerHTML=`${Number(e.target.value)} <small>/ 10</small>`; });
document.addEventListener('click', e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.view){currentView=b.dataset.view;render();window.scrollTo({top:0});return;}
  if(b.dataset.filter){filter=b.dataset.filter;render();return;}
  if(b.dataset.recordFilter){recordFilter=b.dataset.recordFilter;render();return;}
  if(b.dataset.exercise){startExercise(b.dataset.exercise,b.dataset.before);return;}
  if(b.dataset.mood){if(dialog.open&&workflow?.type==='checkin'){workflow.mood=b.dataset.mood;dialog.querySelectorAll('[data-mood]').forEach(el=>{el.classList.toggle('selected',el===b);el.setAttribute('aria-pressed',String(el===b));});}else checkin(b.dataset.mood);return;}
  if(b.dataset.choice){workflow.choice=b.dataset.choice;dialog.querySelectorAll('[data-choice]').forEach(el=>{el.classList.toggle('selected',el===b);el.setAttribute('aria-pressed',String(el===b));});return;}
  if(b.dataset.feedback){workflow.helpful=b.dataset.feedback;dialog.querySelectorAll('[data-feedback]').forEach(el=>{el.classList.toggle('selected',el===b);el.setAttribute('aria-pressed',String(el===b));});return;}
  if(b.dataset.delete){const id=b.dataset.delete;modal('DELETE RECORD · 删除记录','删除这条记录？','<p class="intro">删除后无法恢复，其他记录不会受到影响。</p>',`<button class="secondary" data-action="close">保留</button><button class="primary" data-confirm-delete="${escape(id)}">确认删除</button>`);return;}
  if(b.dataset.confirmDelete){records=records.filter(r=>r.id!==b.dataset.confirmDelete);save();close();render();toast('这条记录已删除');return;}
  switch(b.dataset.action){
    case 'close':close();break;
    case 'checkin':checkin();break;
    case 'save-checkin':saveCheckin();break;
    case 'help':help();break;
    case 'privacy':privacy();break;
    case 'browse':close();currentView='exercises';render();break;
    case 'view-records':close();currentView='records';recordFilter='全部';render();break;
    case 'begin':workflow.before=Number($('#intensity').value);workflow.step=0;showStep();break;
    case 'previous':collect();workflow.step--;showStep();break;
    case 'next':collect();if(needsSupport(workflow.answers.join(' '))){help();break;}if(workflow.id==='plan'&&workflow.step===0&&!workflow.choice){toast('选一个你愿意尝试的小行动，或先到这里');break;}if(workflow.step===2)review();else{workflow.step++;showStep();}break;
    case 'back-practice':showStep();break;
    case 'save-exercise':saveExercise();break;
    case 'timer':if(timer){stopTimer();b.textContent='继续计时';}else{if(remaining===0)remaining=30;b.textContent='暂停计时';timer=setInterval(()=>{remaining--;$('#timer-value').textContent=`00:${String(remaining).padStart(2,'0')}`;if(remaining<=0){stopTimer();b.textContent='再来一次';toast('可以慢慢进入下一步了');}},1000);}break;
    case 'reset-timer':stopTimer();remaining=30;$('#timer-value').textContent='00:30';$('[data-action="timer"]').textContent='开始计时';break;
    case 'confirm-clear':modal('CLEAR RECORDS · 清空记录','清空所有本地记录？','<p class="intro">包括示例、签到和练习记录，删除后无法恢复。</p>','<button class="secondary" data-action="privacy">返回</button><button class="primary" data-action="clear">确认清空</button>');break;
    case 'clear':records=[];save();close();render();toast('全部本地记录已清空');break;
  }
});
render();
