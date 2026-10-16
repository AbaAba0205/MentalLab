// Compatibility export for existing consumers; content lives in individual modules.
import { exercises, type ExerciseId } from './training/registry.js';
import type { ExerciseStep } from './training/types.js';
export type { ExerciseStep } from './training/types.js';
export const steps = Object.fromEntries(exercises.map(item => [item.id, item.steps])) as Record<ExerciseId, ExerciseStep[]>;
