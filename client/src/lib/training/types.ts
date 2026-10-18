export interface ExerciseStep {
  title: string;
  intro: string;
  prompt?: string;
  placeholder?: string;
  choices?: string[];
  required?: boolean;
  timer?: boolean;
  durationSeconds?: number;
  breathing?: boolean;
  counter?: string;
  examples?: string[];
  fields?: PracticeField[];
}

export interface PracticeField {
  id: string;
  label: string;
  placeholder?: string;
  choices?: string[];
  multiple?: boolean;
}

export interface SkillGuide {
  title: string;
  explanation: string;
  examples: string[];
  methods: string[];
  metric: string;
  levels: string[];
  reflections: string[];
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
  guide?: SkillGuide;
  steps: ExerciseStep[];
}
