export type ExerciseId = 'ground' | 'thought' | 'plan';
export type RecordKind = 'checkin' | 'exercise';

export interface PracticeRecord {
  id: string;
  date: string;
  kind: RecordKind;
  title: string;
  mood: string;
  before: number | null;
  after: number | null;
  note: string;
  helpful: string;
  demo: boolean;
}

export interface Exercise {
  id: ExerciseId;
  title: string;
  subtitle: string;
  category: string;
  time: string;
  icon: string;
  color: string;
  description: string;
}

// Keep the key so existing demo users retain their records after migration.
export const storageKey = 'mind-island-demo-v1';

export const moods = [
  { id: 'happy', label: '还不错', face: '◡', color: '#e4b362' },
  { id: 'calm', label: '很平静', face: '–', color: '#87b8aa' },
  { id: 'anxious', label: '有点焦虑', face: '﹏', color: '#a698cf' },
  { id: 'sad', label: '有点低落', face: '⌢', color: '#86b7d0' },
  { id: 'angry', label: '有点烦躁', face: 'へ', color: '#d69994' },
];

export const exercises: Exercise[] = [
  { id: 'ground', title: '先稳一稳', subtitle: '给思绪一个温柔的暂停', category: '情绪调节', time: '2 分钟', icon: 'flower', color: 'mint', description: '把注意力带回此刻，从身边的小事开始。' },
  { id: 'thought', title: '拆开一个担心', subtitle: '想法不一定就是事实', category: '想法整理', time: '5 分钟', icon: 'cloud', color: 'lavender', description: '换一个角度，看看考试前那个放不下的念头。' },
  { id: 'plan', title: '考试前的小计划', subtitle: '迈出刚刚好的一小步', category: '行动计划', time: '3 分钟', icon: 'sun', color: 'peach', description: '把很多个“怎么办”，变成一个“我可以”。' },
];

export function recommendation(intensity: number): ExerciseId {
  if (!validIntensity(intensity) || intensity === null) throw new Error('Invalid intensity');
  return intensity >= 7 ? 'ground' : intensity >= 4 ? 'thought' : 'plan';
}

// Demonstration guard only; this is NOT a clinical risk assessment.
export function needsSupport(text: string): boolean {
  return /自杀|自伤|不想活|想死|伤害自己|伤害别人|正在被打/.test(text);
}

function validIntensity(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 10);
}

type RecordInput = Pick<PracticeRecord, 'kind' | 'title'> & Partial<Pick<PracticeRecord, 'mood' | 'before' | 'after' | 'note' | 'helpful'>>;

// randomUUID requires a secure context; LAN HTTP previews still expose getRandomValues.
export function recordId(source: Pick<Crypto, 'getRandomValues'> & Partial<Pick<Crypto, 'randomUUID'>> = crypto): string {
  if (typeof source.randomUUID === 'function') return source.randomUUID();
  const bytes = source.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function newRecord({ kind, title, mood = '', before = null, after = null, note = '', helpful = '' }: RecordInput): PracticeRecord {
  if (!['checkin', 'exercise'].includes(kind)) throw new Error('Invalid record kind');
  if (typeof title !== 'string' || !title.trim()) throw new Error('Invalid record title');
  if (!validIntensity(before) || !validIntensity(after)) throw new Error('Invalid intensity');
  return { id: recordId(), date: new Date().toISOString(), kind, title, mood, before, after, note: note.slice(0, 4000), helpful, demo: false };
}

export function readRecords(raw: string | null): PracticeRecord[] {
  try {
    const value: unknown = JSON.parse(raw ?? 'null');
    if (!Array.isArray(value)) return [];
    return value.flatMap((item: unknown): PracticeRecord[] => {
      if (!item || typeof item !== 'object') return [];
      const r = item as Record<string, unknown>;
      if (typeof r.id !== 'string' || !r.id || typeof r.title !== 'string' || !r.title.trim()
        || typeof r.date !== 'string' || !Number.isFinite(Date.parse(r.date))
        || (r.kind !== 'exercise' && r.kind !== 'checkin')) return [];
      const before = r.before ?? null, after = r.after ?? null;
      if (!validIntensity(before) || !validIntensity(after)) return [];
      for (const field of ['mood', 'note', 'helpful']) {
        if (r[field] !== undefined && typeof r[field] !== 'string') return [];
      }
      return [{ id: r.id, title: r.title, date: r.date, kind: r.kind, before, after,
        mood: typeof r.mood === 'string' ? r.mood : '',
        note: typeof r.note === 'string' ? r.note.slice(0, 4000) : '',
        helpful: typeof r.helpful === 'string' ? r.helpful : '', demo: r.demo === true }];
    });
  } catch { return []; }
}

export function seedRecords(now = new Date()): PracticeRecord[] {
  return [
    { title: '先稳一稳', kind: 'exercise' as const, before: 6, after: 4, mood: '', note: '留意窗外的树，感觉轻松了一点。', helpful: '有一点帮助' },
    { title: '情绪签到', kind: 'checkin' as const, before: 5, after: null, mood: '有点焦虑', note: '想到周五的考试，有点紧张。', helpful: '' },
  ].map((r, i) => ({ ...r, id: `demo-${i}`, date: new Date(now.getTime() - (i + 1) * 86400000).toISOString(), demo: true }));
}
