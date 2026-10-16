const byId = id => document.getElementById(id);
let snapshot;
async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json' }, cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '请求失败');
  return data;
}
function node(tag, text, className) { const item = document.createElement(tag); if (text !== undefined) item.textContent = text; if (className) item.className = className; return item; }
function button(label, action, danger = false) {
  const item = node('button', label, danger ? 'danger' : '');
  item.addEventListener('click', async () => { item.disabled = true; try { await action(); } catch (error) { byId('status').textContent = error.message; } finally { item.disabled = false; } });
  return item;
}
async function mutate(path, method, data, question) {
  if (question && !confirm(question)) return;
  await api(path, { method, ...(data ? { body: JSON.stringify(data) } : {}) });
  await refresh(); byId('status').textContent = '操作已保存';
}
function render() {
  const term = byId('search').value.toLowerCase();
  const matches = value => JSON.stringify(value).toLowerCase().includes(term);
  byId('counts').textContent = `本次加载 ${snapshot.users.length} 位用户、${snapshot.records.length} 条记录、${snapshot.histories.length} 组对话（用户和记录最多各显示最近 500 项，对话最近 200 项）`;
  byId('user-rows').replaceChildren(...snapshot.users.filter(matches).map(user => {
    const row = node('tr');
    for (const text of [user.name, user.email, `${user.role === 'admin' ? '管理员' : '普通用户'} / ${user.disabled ? '已停用' : '正常'}`, new Date(user.createdAt).toLocaleString()]) row.append(node('td', text));
    const actions = node('td');
    if (user.role !== 'admin') {
      actions.append(button(user.disabled ? '启用' : '停用', () => mutate(`/api/admin/users/${encodeURIComponent(user.id)}`, 'PATCH', { disabled: !user.disabled }, '确认更改该用户状态？现有登录会话将被注销。')));
      actions.append(button('删除用户', () => mutate(`/api/admin/users/${encodeURIComponent(user.id)}`, 'DELETE', null, '确认删除用户及其全部记录、对话和登录会话？此操作无法恢复。'), true));
    }
    row.append(actions); return row;
  }));
  byId('record-list').replaceChildren(...snapshot.records.filter(matches).map(record => {
    const item = node('article'); item.append(node('strong', `${record.data.title} · ${record.email}`), node('p', `${record.data.mood} · 强度 ${record.data.before ?? '—'} → ${record.data.after ?? '—'} · ${record.data.date}`), node('pre', record.data.note || '未填写内容'));
    item.append(button('删除记录', () => mutate(`/api/admin/record?userId=${encodeURIComponent(record.userId)}&id=${encodeURIComponent(record.id)}`, 'DELETE', null, '确认删除这条练习记录？'), true)); return item;
  }));
  byId('history-list').replaceChildren(...snapshot.histories.filter(matches).map(history => {
    const item = node('article'), detail = node('details');
    detail.append(node('summary', `${history.email} · ${history.channel === 'chat' ? `随心聊 · ${history.title || '新会话'}` : '情境练习'} · ${history.data.length} 条消息`));
    for (const message of history.data) detail.append(node('p', `${message.role === 'user' ? '用户' : '助手'}：${message.content}`));
    item.append(detail, button('清空对话', () => mutate(`/api/admin/history?userId=${encodeURIComponent(history.userId)}&channel=${history.channel}${history.conversationId ? `&conversationId=${encodeURIComponent(history.conversationId)}` : ''}`, 'DELETE', null, '确认清空该用户的这组对话？'), true)); return item;
  }));
  byId('audit-list').replaceChildren(...snapshot.audit.map(entry => node('p', `${entry.date} · ${entry.action} · ${entry.target} · 操作者 ${entry.actorId}`)));
}
async function refresh() {
  snapshot = await api('/api/admin/overview');
  byId('login').hidden = true; byId('dashboard').hidden = false; byId('logout').hidden = false;
  const form = byId('reminder-form'); form.elements.interval.value = snapshot.reminders.intervalSeconds; form.elements.messages.value = snapshot.reminders.messages.join('\n\n'); render();
}
byId('login-form').addEventListener('submit', async event => {
  event.preventDefault(); const form = event.currentTarget, submit = form.querySelector('button'); submit.disabled = true;
  try { const data = await api('/api/auth/login', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) }); if (data.user.role !== 'admin') { await api('/api/auth/logout', { method: 'POST' }); throw new Error('该账户没有管理员权限'); } form.reset(); await refresh(); byId('status').textContent = ''; }
  catch (error) { byId('status').textContent = error.message; } finally { submit.disabled = false; }
});
byId('reminder-form').addEventListener('submit', async event => { event.preventDefault(); const form = event.currentTarget, submit = form.querySelector('button'); submit.disabled = true; try { await mutate('/api/admin/reminders', 'PUT', { intervalSeconds: Number(form.elements.interval.value), messages: form.elements.messages.value.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean) }); } catch (error) { byId('status').textContent = error.message; } finally { submit.disabled = false; } });
byId('logout').addEventListener('click', async () => { try { await api('/api/auth/logout', { method: 'POST' }); location.reload(); } catch (error) { byId('status').textContent = error.message; } });
byId('refresh').addEventListener('click', () => refresh().then(() => { byId('status').textContent = '数据已刷新'; }).catch(error => { byId('status').textContent = error.message; }));
byId('search').addEventListener('input', render);
api('/api/auth/me').then(data => { if (data.user.role === 'admin') return refresh(); }).catch(() => {});
