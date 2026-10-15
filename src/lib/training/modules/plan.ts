import type { TrainingModule } from '../types';

export const plan = { id: 'plan' as const, title: '考试前的小计划', subtitle: '迈出刚刚好的一小步', category: '行动计划', time: '3 分钟', icon: 'sun', color: 'peach', description: '把很多个“怎么办”，变成一个“我可以”。',
  useWhen: "用户情绪平稳且主动希望制定一个现实小行动时",
  maxIntensity: 3,
  steps: [
    {title:'选一个刚刚好的小行动',intro:'你不需要一次解决所有问题。选一个现在愿意尝试的就好。',required:true,choices:['整理明天的考试用品','为复习留一个结束时间','写下一个想问老师的问题','做一点让身体舒服的小事']},
    {title:'让这一步更容易开始',intro:'什么时候、在哪里做？尽量具体，也可以把任务再缩小一点。',placeholder:'比如：今晚吃完饭，在书桌前把笔和准考证放进包里。'},
    {title:'给计划留一点弹性',intro:'如果到时候没有做到，你愿意怎样调整？不需要惩罚自己。',placeholder:'比如：如果太累，就先把笔放进去。剩下的明早再检查。'}
  ],
} satisfies TrainingModule;
