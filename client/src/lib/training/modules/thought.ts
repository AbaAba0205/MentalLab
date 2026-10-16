import type { TrainingModule } from '../types';

export const thought = { id: 'thought' as const, title: '拆开一个担心', subtitle: '想法不一定就是事实', category: '想法整理', time: '5 分钟', icon: 'cloud', color: 'lavender', description: '换一个角度，看看考试前那个放不下的念头。',
  useWhen: "用户情绪平稳且愿意整理担心时；不用于高强度情绪",
  maxIntensity: 3,
  steps: [
    {title:'先把事情和想法分开',intro:'只写发生的事，再写脑海里的担心。不必急着判断对错。',placeholder:'比如：明天有数学考试。我担心考不好，就证明自己很差。'},
    {title:'给另一种可能留点空间',intro:'有哪些你知道的事实？有没有事实让这个担心没那么绝对？如果不知道，也可以这样写。',placeholder:'比如：上一次有几道题不会，但也完成了不少题。一次考试不能说明全部。'},
    {title:'写一句你真正相信的话',intro:'不用强迫自己积极。试着写一句既承认困难，也给自己留点空间的话。',placeholder:'比如：我很在乎这次考试。我可以认真准备，也允许自己有不会的题。'}
  ],
} satisfies TrainingModule;
