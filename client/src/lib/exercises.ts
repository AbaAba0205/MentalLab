// Compatibility export for existing consumers; content lives in individual modules.
import { exercises, type ExerciseId } from './training/registry';
import type { ExerciseStep } from './training/types';
export type { ExerciseStep } from './training/types';
export const steps = Object.fromEntries(exercises.map(item => [item.id, item.steps])) as Record<ExerciseId, ExerciseStep[]>;
