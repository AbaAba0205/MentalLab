'use client';

import { useCallback, useRef, useState } from 'react';
import { api } from '@/lib/api';
import type { ChatEntry } from './companion-chat';
import { Icon } from './icon';
import { Modal } from './practice-ui';

export interface ConversationSummary { id: string; title: string; createdAt: string; updatedAt: string; messageCount: number }
export interface Conversation extends ConversationSummary { messages: ChatEntry[] }
export interface ConversationSnapshot { conversation: Conversation; conversations: ConversationSummary[] }

export function useConversations(initial: ConversationSnapshot) {
  const [current, setCurrent] = useState(initial.conversation);
  const [conversations, setConversations] = useState(initial.conversations);
  const [busy, setBusy] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);
  const [error, setError] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [deleting, setDeleting] = useState<ConversationSummary | null>(null);
  const locked = useRef(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const disabled = busy || chatBusy;

  async function change(path: string, method: string) {
    if (locked.current || chatBusy) return;
    locked.current = true; setBusy(true); setError('');
    try {
      const next = await api<ConversationSnapshot>(path, method);
      setCurrent(next.conversation); setConversations(next.conversations); setChatBusy(false);
      setShowPicker(false); setDeleting(null);
    } catch (error) { setError(error instanceof Error ? error.message : '暂时无法连接服务器，请重试'); }
    finally { locked.current = false; setBusy(false); }
  }
  const saved = useCallback((conversation: ConversationSummary) => {
    setConversations(previous => [conversation, ...previous.filter(item => item.id !== conversation.id)]);
  }, []);
  const updateDraft = useCallback((value: string) => {
    setDrafts(previous => (previous[current.id] || '') === value ? previous : { ...previous, [current.id]: value });
  }, [current.id]);
  return {
    current, conversations, disabled, busy, error, showPicker, setShowPicker, deleting, setDeleting,
    setChatBusy, saved,
    draft: drafts[current.id] || '', updateDraft,
    create: () => change('/api/chat/conversations', 'POST'),
    select: (id: string) => id === current.id ? setShowPicker(false) : change(`/api/chat/conversations/${encodeURIComponent(id)}/select`, 'POST'),
    remove: () => deleting && change(`/api/chat/conversations/${encodeURIComponent(deleting.id)}`, 'DELETE'),
  };
}
type Controls = ReturnType<typeof useConversations>;

export function ConversationList({ chat }: { chat: Controls }) {
  return <section className="conversation-panel" aria-label="会话列表" aria-busy={chat.busy}>
    <button className="conversation-new" disabled={chat.disabled} onClick={chat.create}><span aria-hidden="true">＋</span>新建会话</button>
    <div className="conversation-heading"><span>最近会话</span><span>{chat.conversations.length}</span></div>
    <div className="conversation-items">{chat.conversations.map(item => <div className={`conversation-row${item.id === chat.current.id ? ' selected' : ''}`} key={item.id}>
      <button className="conversation-select" disabled={chat.disabled} onClick={() => chat.select(item.id)} aria-current={item.id === chat.current.id ? 'true' : undefined} title={item.title}>
        <Icon name="message" /><span>{item.title}<small>{item.messageCount ? `${item.messageCount} 条消息` : '从一点点开始'}</small></span>
      </button>
      <button className="conversation-delete" disabled={chat.disabled} onClick={() => chat.setDeleting(item)} aria-label={`删除会话：${item.title}`} title="删除会话">×</button>
    </div>)}</div>
    {chat.disabled && !chat.busy && <p className="conversation-hint">完成回复、练习和保存后，可切换会话。</p>}
    {chat.error && <p className="form-error" role="alert">{chat.error}</p>}
  </section>;
}

export function MobileConversationControls({ chat }: { chat: Controls }) {
  return <div className="conversation-mobile">
    <button className="conversation-picker-button" disabled={chat.disabled} onClick={() => chat.setShowPicker(true)} aria-label="选择会话"><Icon name="message" /><span>{chat.conversations.find(item => item.id === chat.current.id)?.title || '新会话'}</span><span aria-hidden="true">⌄</span></button>
    <button className="conversation-new" disabled={chat.disabled} onClick={chat.create}><span aria-hidden="true">＋</span>新建会话</button>
    {chat.error && <p className="form-error" role="alert">{chat.error}</p>}
  </div>;
}

export function ConversationDialogs({ chat }: { chat: Controls }) {
  if (chat.deleting) return <Modal label="YOUR CONVERSATIONS · 会话管理" title="删除这个会话？" onClose={() => { if (!chat.busy) chat.setDeleting(null); }} actions={<><button className="secondary" disabled={chat.busy} onClick={() => chat.setDeleting(null)}>保留会话</button><button className="primary" disabled={chat.disabled} onClick={() => { void chat.remove(); }}>确认删除会话</button></>}>
    <p className="intro">“{chat.deleting.title}”及其中的聊天消息将从账户中删除，无法恢复。已保存的练习记录会保留。</p>{chat.error && <p className="form-error" role="alert">{chat.error}</p>}
  </Modal>;
  if (chat.showPicker) return <Modal label="YOUR CONVERSATIONS · 历史会话" title="选择一个会话" onClose={() => { if (!chat.busy) chat.setShowPicker(false); }}><ConversationList chat={chat} /></Modal>;
  return null;
}
