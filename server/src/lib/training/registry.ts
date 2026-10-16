import { ground } from './modules/ground.js';
import { thought } from './modules/thought.js';
import { plan } from './modules/plan.js';
import type { TrainingModule } from './types.js';

// Add a module here once: the library, runner and AI catalog all use this registry.
export const trainingModules = [ground, thought, plan];
export type ExerciseId = (typeof trainingModules)[number]['id'];
export type Exercise = TrainingModule & { id: ExerciseId };
export const exercises: Exercise[] = trainingModules;
export const exerciseCategories = [...new Set(exercises.map(item => item.category))];
export function isExerciseId(value: unknown): value is ExerciseId {
  return typeof value === 'string' && exercises.some(item => item.id === value);
}
export function getExercise(id: ExerciseId): Exercise {
  const exercise = exercises.find(item => item.id === id);
  if (!exercise) throw new Error('Unknown training module');
  return exercise;
}
