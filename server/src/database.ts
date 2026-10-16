import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
export type User = { id: string; email: string; name: string; role: 'user' | 'admin'; disabled: number; onboarded: number; createdAt: string };
export type UserRow = User & { passwordHash: string };
export type ConversationSummary = { id: string; title: string; createdAt: string; updatedAt: string; messageCount: number };
export type Conversation = ConversationSummary & { messages: unknown[] };
export const sessionCookie = 'xinqing_session';
export const sessionLifetime = 7 * 24 * 60 * 60;

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64) as Buffer;
  return `${salt}:${key.toString('hex')}`;
}
export async function verifyPassword(password: string, hash: string) {
  const [salt, encoded] = hash.split(':');
  const expected = Buffer.from(encoded, 'hex');
  const key = await scrypt(password, salt, 64) as Buffer;
  return expected.length === key.length && timingSafeEqual(key, expected);
}
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export function publicUser(row: UserRow | User) {
  return { id: row.id, email: row.email, name: row.name, role: row.role, onboarded: Boolean(row.onboarded), disabled: Boolean(row.disabled), createdAt: row.createdAt };
}

export class Store {
  readonly db: DatabaseSync;
  constructor(path = process.env.DATABASE_PATH || './data/xinqing.sqlite') {
    if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
        passwordHash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','admin')),
        disabled INTEGER NOT NULL DEFAULT 0, onboarded INTEGER NOT NULL DEFAULT 0, createdAt TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        tokenHash TEXT PRIMARY KEY, userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expiresAt INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS records (
        id TEXT NOT NULL, userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, data TEXT NOT NULL,
        PRIMARY KEY(userId, id)
      );
      CREATE TABLE IF NOT EXISTS histories (
        userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, channel TEXT NOT NULL,
        data TEXT NOT NULL, updatedAt TEXT NOT NULL, PRIMARY KEY(userId, channel)
      );
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, resetAt INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS audit (id TEXT PRIMARY KEY, actorId TEXT NOT NULL, action TEXT NOT NULL, target TEXT NOT NULL, date TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY, userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL, data TEXT NOT NULL DEFAULT '[]', createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS conversations_owner ON conversations(userId, updatedAt DESC);
      CREATE TABLE IF NOT EXISTS chat_selection (
        userId TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        conversationId TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE
      );
    `);
    // Move old single-chat histories atomically. Deleting the source makes reruns idempotent.
    this.db.exec('BEGIN IMMEDIATE');
    try {
      for (const row of this.db.prepare("SELECT * FROM histories WHERE channel='chat'").all()) {
        const messages = JSON.parse(row.data as string) as unknown[];
        if (messages.length) {
          const conversation = this.createConversation(row.userId as string, messages, row.updatedAt as string);
          this.db.prepare('INSERT OR IGNORE INTO chat_selection VALUES (?,?)').run(row.userId as string, conversation.id);
        }
      }
      this.db.exec("DELETE FROM histories WHERE channel='chat'; COMMIT");
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
    const reminders = JSON.parse(readFileSync(new URL('../config/reminders.json', import.meta.url), 'utf8'));
    this.db.prepare('INSERT OR IGNORE INTO settings(key,data) VALUES (?,?)').run('reminders', JSON.stringify(reminders));
  }
  user(id: string) { return this.db.prepare('SELECT * FROM users WHERE id=?').get(id) as UserRow | undefined; }
  email(email: string) { return this.db.prepare('SELECT * FROM users WHERE email=?').get(email) as UserRow | undefined; }
  async createUser(email: string, name: string, password: string, role: 'user' | 'admin' = 'user') {
    const passwordHash = await hashPassword(password);
    const id = randomUUID();
    this.db.prepare('INSERT INTO users(id,email,name,passwordHash,role,createdAt) VALUES (?,?,?,?,?,?)').run(id, email, name, passwordHash, role, new Date().toISOString());
    return this.user(id)!;
  }
  login(userId: string) {
    const token = randomBytes(32).toString('base64url');
    this.db.prepare('DELETE FROM sessions WHERE expiresAt<=?').run(Date.now());
    this.db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(digest(token), userId, Date.now() + sessionLifetime * 1000);
    return token;
  }
  authenticate(token: string | undefined) {
    if (!token) return undefined;
    return this.db.prepare('SELECT u.* FROM users u JOIN sessions s ON s.userId=u.id WHERE s.tokenHash=? AND s.expiresAt>? AND u.disabled=0').get(digest(token), Date.now()) as UserRow | undefined;
  }
  logout(token: string) { this.db.prepare('DELETE FROM sessions WHERE tokenHash=?').run(digest(token)); }
  records(userId: string) {
    return this.db.prepare('SELECT data FROM records WHERE userId=? ORDER BY json_extract(data,\'$.date\') DESC').all(userId).map(row => JSON.parse(row.data as string));
  }
  history(userId: string, channel: string): unknown[] {
    if (channel === 'chat') {
      const selected = this.selectedConversation(userId);
      return selected?.messages || [];
    }
    const row = this.db.prepare('SELECT data FROM histories WHERE userId=? AND channel=?').get(userId, channel);
    return row ? JSON.parse(row.data as string) : [];
  }
  saveHistory(userId: string, channel: string, messages: unknown[]) {
    if (channel === 'chat') { this.saveConversation(userId, this.currentConversation(userId).id, messages); return; }
    this.db.prepare('INSERT INTO histories VALUES (?,?,?,?) ON CONFLICT(userId,channel) DO UPDATE SET data=excluded.data,updatedAt=excluded.updatedAt').run(userId, channel, JSON.stringify(messages), new Date().toISOString());
  }
  private conversationTitle(messages: unknown[]) {
    const first = messages.find((message): message is { role: string; content: string } => Boolean(message && typeof message === 'object' && 'role' in message && message.role === 'user' && 'content' in message && typeof message.content === 'string'));
    return first?.content.trim().replace(/\s+/g, ' ').slice(0, 40) || '新会话';
  }
  conversations(userId: string) {
    return this.db.prepare('SELECT id,title,createdAt,updatedAt,json_array_length(data) AS messageCount FROM conversations WHERE userId=? ORDER BY updatedAt DESC,rowid DESC').all(userId) as ConversationSummary[];
  }
  conversation(userId: string, id: string): Conversation | undefined {
    const row = this.db.prepare('SELECT id,title,data,createdAt,updatedAt FROM conversations WHERE userId=? AND id=?').get(userId, id);
    if (!row) return undefined;
    const messages = JSON.parse(row.data as string) as unknown[];
    return { id: row.id as string, title: row.title as string, createdAt: row.createdAt as string, updatedAt: row.updatedAt as string, messages, messageCount: messages.length };
  }
  createConversation(userId: string, messages: unknown[] = [], date = new Date().toISOString()) {
    const id = randomUUID();
    this.db.prepare('INSERT INTO conversations VALUES (?,?,?,?,?,?)').run(id, userId, this.conversationTitle(messages), JSON.stringify(messages), date, date);
    return this.conversation(userId, id)!;
  }
  selectConversation(userId: string, id: string) {
    const conversation = this.conversation(userId, id);
    if (!conversation) return undefined;
    this.db.prepare('INSERT INTO chat_selection VALUES (?,?) ON CONFLICT(userId) DO UPDATE SET conversationId=excluded.conversationId').run(userId, id);
    return conversation;
  }
  private selectedConversation(userId: string) {
    const row = this.db.prepare('SELECT conversationId FROM chat_selection WHERE userId=?').get(userId);
    return row ? this.conversation(userId, row.conversationId as string) : undefined;
  }
  currentConversation(userId: string) {
    const selected = this.selectedConversation(userId);
    if (selected) return selected;
    const latest = this.conversations(userId)[0];
    const conversation = latest ? this.conversation(userId, latest.id)! : this.createConversation(userId);
    return this.selectConversation(userId, conversation.id)!;
  }
  saveConversation(userId: string, id: string, messages: unknown[]) {
    const existing = this.conversation(userId, id);
    if (!existing) return undefined;
    // Once named, clearing or trimming the transcript keeps the recognizable title.
    const title = existing.title === '新会话' ? this.conversationTitle(messages) : existing.title;
    this.db.prepare('UPDATE conversations SET data=?,title=?,updatedAt=? WHERE userId=? AND id=?').run(JSON.stringify(messages), title, new Date().toISOString(), userId, id);
    return this.conversation(userId, id)!;
  }
  reminder() { return JSON.parse(this.db.prepare('SELECT data FROM settings WHERE key=?').get('reminders')!.data as string); }
  audit(actorId: string, action: string, target: string) { this.db.prepare('INSERT INTO audit VALUES (?,?,?,?,?)').run(randomUUID(), actorId, action, target, new Date().toISOString()); }
  allow(key: string, limit: number, window = 60_000) {
    const now = Date.now();
    this.db.prepare('DELETE FROM limits WHERE resetAt<=?').run(now);
    const row = this.db.prepare('INSERT INTO limits VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').get(key, now + window);
    return Number(row!.count) <= limit;
  }
  close() { this.db.close(); }
}
