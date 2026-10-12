export const moods = [
  { id: 'happy', label: '还不错', face: '◡', color: '#e4b362' },
  { id: 'calm', label: '很平静', face: '–', color: '#87b8aa' },
  { id: 'anxious', label: '有点焦虑', face: '﹏', color: '#a698cf' },
  { id: 'sad', label: '有点低落', face: '⌢', color: '#86b7d0' },
  { id: 'angry', label: '有点烦躁', face: 'へ', color: '#d69994' }
];
export const exercises = [
  { id: 'ground', title: '先稳一稳', subtitle: '给思绪一个温柔的暂停', category: '情绪调节', time: '2 分钟', icon: 'flower', color: 'mint', description: '把注意力带回此刻，从身边的小事开始。' },
  { id: 'thought', title: '拆开一个担心', subtitle: '想法不一定就是事实', category: '想法整理', time: '5 分钟', icon: 'cloud', color: 'lavender', description: '换一个角度，看看考试前那个放不下的念头。' },
  { id: 'plan', title: '考试前的小计划', subtitle: '迈出刚刚好的一小步', category: '行动计划', time: '3 分钟', icon: 'sun', color: 'peach', description: '把很多个“怎么办”，变成一个“我可以”。' }
];
export function recommendation(intensity) { return Number(intensity) >= 7 ? 'ground' : Number(intensity) >= 4 ? 'thought' : 'plan'; }
export function needsSupport(text) { return /自杀|自伤|不想活|想死|伤害自己|伤害别人|正在被打/.test(text); }
export function newRecord({ kind, title, mood = '', before = null, after = null, note = '', helpful = '' }) {
  if (!['checkin', 'exercise'].includes(kind)) throw new Error('Invalid record kind');
  for (const value of [before, after]) if (value !== null && (!Number.isFinite(value) || value < 0 || value > 10)) throw new Error('Invalid intensity');
  return { id: crypto.randomUUID(), date: new Date().toISOString(), kind, title, mood, before, after, note: note.slice(0, 1000), helpful, demo: false };
}
export function readRecords(raw) {
  try { const value = JSON.parse(raw); return Array.isArray(value) ? value.filter(r => r && typeof r.id === 'string' && typeof r.title === 'string' && typeof r.date === 'string' && Number.isFinite(Date.parse(r.date)) && ['exercise','checkin'].includes(r.kind)) : []; } catch { return []; }
}
export function seedRecords() {
  const base = new Date();
  return [{ title: '先稳一稳', kind: 'exercise', before: 6, after: 4, note: '留意窗外的树，感觉轻松了一点。', helpful: '有一点帮助' }, { title: '情绪签到', kind: 'checkin', before: 5, mood: '有点焦虑', note: '想到周五的考试，有点紧张。' }].map((r, i) => ({ ...r, id: `demo-${i}`, date: new Date(base.getTime() - (i + 1) * 86400000).toISOString(), demo: true }));
}
