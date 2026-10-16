export interface ExerciseStep {
  title: string;
  intro: string;
  prompt?: string;
  placeholder?: string;
  choices?: string[];
  required?: boolean;
  timer?: boolean;
}

export interface TrainingModule {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  time: string;
  icon: string;
  color: string;
  description: string;
  /** Used by the companion to select only registered, reviewed exercises. */
  useWhen: string;
  /** Above this self-rated intensity, offer stabilization before this module. */
  maxIntensity?: number;
  steps: ExerciseStep[];
}
