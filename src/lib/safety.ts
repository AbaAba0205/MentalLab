export type RiskLevel = 'low' | 'medium' | 'high' | 'imminent';

export interface RiskAssessment {
  level: RiskLevel;
  requiresHandoff: boolean;
  reason: string;
}

const imminentPatterns = [
  /(?:正在|已经|马上|现在就).{0,8}(?:自杀|自伤|割腕|跳楼|服药|伤害自己|伤害别人)/,
  /(?:手里|身边|已经准备).{0,8}(?:刀|药|绳|武器)/,
  /(?:自杀|自伤|伤害).{0,8}(?:计划|方法|工具|地点)/,
];

const highPatterns = [
  /自杀|自伤|(?:我)?想死(?:了|去|掉)?(?:[，。！？,.!\s]|$)|不想活(?:了|下去|着)?(?:[，。！？,.!\s]|$)|结束生命|伤害自己|伤害别人|杀了自己/,
  /(?:被打|虐待|性侵|家暴|人身安全|人身威胁)/,
];

const mediumPatterns = [
  /活着没意思|永远消失|撑不下去|不如死了|希望醒不过来/,
  /(?:控制不住|无法保证).{0,8}(?:安全|冲动|自己)/,
];

export function assessRisk(text: string): RiskAssessment {
  const normalized = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (imminentPatterns.some(pattern => pattern.test(normalized))) {
    return { level: 'imminent', requiresHandoff: true, reason: '检测到可能正在发生或即将发生的伤害风险' };
  }
  if (highPatterns.some(pattern => pattern.test(normalized))) {
    return { level: 'high', requiresHandoff: true, reason: '检测到明确伤害、自杀或人身安全信号' };
  }
  if (mediumPatterns.some(pattern => pattern.test(normalized))) {
    return { level: 'medium', requiresHandoff: true, reason: '检测到需要优先确认现实安全的表达' };
  }
  return { level: 'low', requiresHandoff: false, reason: '未发现预设的明确高风险信号' };
}
