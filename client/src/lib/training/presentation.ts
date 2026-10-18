import type { ExerciseId } from './registry';
import type { ExerciseStep } from './types';

export const presentations = {
  'participate-guide': 'lesson', 'participate-activity': 'activity', 'participate-immersion': 'focus',
  'participate-senses': 'senses', 'participate-counter': 'return-counter', 'participate-rating': 'rating', 'participate-daily': 'daily',
  'observe-guide': 'lesson', 'observe-clouds': 'clouds', 'observe-body': 'body', 'observe-labels': 'labels',
  'observe-urge': 'wave', 'observe-counter': 'notice-counter', 'observe-daily': 'daily',
  'wise-guide': 'lesson', 'wise-decision': 'decision', 'wise-minds': 'minds', 'wise-breathing': 'breathing',
  'wise-friend': 'letter', 'wise-integration': 'wisdom', 'wise-quick': 'breathing',
  'describe-guide': 'lesson', 'describe-facts': 'facts', 'describe-rewrite': 'rewrite',
  'describe-body': 'body', 'describe-scenario': 'scenario', 'describe-daily': 'daily',
} as const satisfies Record<ExerciseId, string>;

export type Presentation = typeof presentations[ExerciseId] | 'intention' | 'body-journal';
export function stepPresentation(id: ExerciseId, step: ExerciseStep, index: number): Presentation {
  if (step.breathing) return 'breathing';
  if (id === 'participate-immersion' && index === 0) return 'activity';
  if (id === 'participate-activity' && index > 0) return 'intention';
  if ((id === 'observe-body' || id === 'describe-body') && index > 0) return step.timer ? 'focus' : 'body-journal';
  if ((id === 'wise-minds' || id === 'wise-integration') && index === 0) return 'minds';
  if (id === 'wise-minds' && index > 1) return 'wisdom';
  if (id === 'describe-scenario' && index > 0) return 'rewrite';
  return presentations[id];
}

export const categoryThemes: Record<string, string> = { '参与': 'apricot', '观察': 'sky', '智慧心': 'iris', '描述': 'sage' };
