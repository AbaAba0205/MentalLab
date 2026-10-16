export interface PlannedCourse {
  id: string;
  title: string;
  description: string;
  status: 'planned';
}

// Reserve the catalog boundary; publishing lessons will be a separate feature.
export const plannedCourses: PlannedCourse[] = [
  { id: 'emotions', title: '认识我的情绪', description: '从身体、想法和感受出发，学习认识此刻的自己。', status: 'planned' },
  { id: 'thoughts', title: '与担心相处', description: '认识想法与事实的区别，给另一种可能留出空间。', status: 'planned' },
  { id: 'boundaries', title: '表达与边界', description: '学习表达需要，也尊重自己和他人的边界。', status: 'planned' },
];
