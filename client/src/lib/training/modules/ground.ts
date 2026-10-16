import type { TrainingModule } from '../types';

export const ground = { id: 'ground' as const, title: '先稳一稳', subtitle: '给思绪一个温柔的暂停', category: '情绪调节', time: '2 分钟', icon: 'flower', color: 'mint', description: '把注意力带回此刻，从身边的小事开始。',
  useWhen: "情绪强烈、需要暂停时的温和接地；不代替危机支持",
  steps: [
    {title:'找一个舒服的位置',intro:'可以坐着，也可以站着。睁着眼睛，让双脚轻轻接触地面。',prompt:'留意脚底与地面接触的感觉。不需要改变它，只要注意到就好。'},
    {title:'看看你身边的世界',intro:'慢慢找出三个你能看到的东西，在心里说出它们的颜色或形状。',prompt:'一扇窗、一张桌子、一片叶子……普通的小东西也可以。',timer:true},
    {title:'把注意力带回这里',intro:'找出一个你能听到的声音，再留意身体与椅子或地面的接触。',prompt:'按自己舒服的节奏呼吸。想走神也没关系，注意到后再轻轻回来。'}
  ],
} satisfies TrainingModule;
