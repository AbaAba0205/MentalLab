'use client';

import { useEffect, useState } from 'react';
import { api, APIError, type Account } from '@/lib/api';
import MindIsland from './mind-island';

export function AccountGate() {
  const [user, setUser] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api<{ user: Account }>('/api/auth/me').then(data => setUser(data.user)).catch(error => { if (!(error instanceof APIError && error.status === 401)) setError('暂时无法连接服务器，请稍后重试'); }).finally(() => setLoading(false));
  }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return; const form = event.currentTarget;
    const fields = Object.fromEntries(new FormData(form));
    if (mode === 'register' && fields.password !== fields.confirmPassword) { setError('两次填写的密码不一致'); return; }
    setBusy(true); setError('');
    try { const data = await api<{ user: Account }>(`/api/auth/${mode}`, 'POST', fields); form.reset(); setUser(data.user); }
    catch (error) { setError(error instanceof Error ? error.message : '暂时无法连接服务器'); }
    finally { setBusy(false); }
  }
  async function logout() { await api('/api/auth/logout', 'POST'); setMode('login'); setError(''); setUser(null); }
  if (loading) return <main className="account-page" aria-busy="true"><p role="status">正在连接你的小岛…</p></main>;
  if (user) return <MindIsland key={user.id} user={user} onLogout={logout} />;
  return <main className="account-page"><section className="account-card"><span className="account-brand">♥ 心晴</span><p className="eyebrow">A LITTLE SPACE, JUST FOR YOU</p><h1>{mode === 'login' ? '欢迎回到你的小岛' : '为自己留一个小空间'}</h1><p>登录后，签到、练习记录和对话将保存在你的账户中。</p>
    <div className="account-tabs"><button type="button" className={mode === 'login' ? 'primary' : 'secondary'} onClick={() => { setMode('login'); setError(''); }}>登录</button><button type="button" className={mode === 'register' ? 'primary' : 'secondary'} onClick={() => { setMode('register'); setError(''); }}>注册</button></div>
    <form onSubmit={submit} key={mode}>
      {mode === 'register' && <label>昵称<input name="name" required maxLength={40} autoComplete="nickname" /></label>}
      <label>邮箱<input name="email" type="email" required maxLength={254} autoComplete="username" /></label>
      <div><label>密码<input name="password" type="password" required minLength={10} maxLength={128} aria-describedby="password-hint" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label><small id="password-hint">10–128 位字符</small></div>
      {mode === 'register' && <><label>确认密码<input name="confirmPassword" type="password" required minLength={10} maxLength={128} autoComplete="new-password" /></label><label className="account-consent"><input type="checkbox" required />我了解记录和对话由服务器保存，授权管理员可管理这些数据；主动发送的对话可能交给配置的 AI 服务。</label></>}
      {error && <p role="alert" className="form-error">{error}</p>}
      <button type="submit" disabled={busy} className="primary">{busy ? '正在连接…' : mode === 'login' ? '登录我的小岛' : '创建账户'}</button>
    </form><p className="modal-hint">心理健康技能练习，不提供诊断或治疗。有紧急危险时请联系现实中的支持。</p>
  </section></main>;
}
