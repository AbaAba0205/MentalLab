import { plannedCourses } from '@/lib/courses';
import { Icon } from './icon';

export function Courses({ onPractice }: { onPractice: () => void }) {
  return <section className="courses-space" aria-label="课程空间">
    <div className="course-intro"><Icon name="book" /><h2>课程正在慢慢准备中</h2><p>这里将放入心理健康知识、分步课程和课后小练习。以下是筹备方向，暂未开放学习。</p></div>
    <div className="course-grid">{plannedCourses.map(course => <article className="course-card" key={course.id}><span className="tiny-pill">筹备中</span><h3>{course.title}</h3><p>{course.description}</p></article>)}</div>
    <div className="course-footer"><p>现在也可以从一个小练习开始，按自己的节奏体验。</p><button className="primary" onClick={onPractice}>去练习室 ↗</button></div>
  </section>;
}
