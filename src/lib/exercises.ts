import type { ExerciseId } from './model';

export interface ExerciseStep {
  title: string;
  intro: string;
  prompt?: string;
  placeholder?: string;
  choices?: string[];
  timer?: boolean;
}
export const steps: Record<ExerciseId, ExerciseStep[]> = {
  ground: [
    {title:'找一个舒服的位置',intro:'可以坐着，也可以站着。睁着眼睛，让双脚轻轻接触地面。',prompt:'留意脚底与地面接触的感觉。不需要改变它，只要注意到就好。'},
    {title:'看看你身边的世界',intro:'慢慢找出三个你能看到的东西，在心里说出它们的颜色或形状。',prompt:'一扇窗、一张桌子、一片叶子……普通的小东西也可以。',timer:true},
    {title:'把注意力带回这里',intro:'找出一个你能听到的声音，再留意身体与椅子或地面的接触。',prompt:'按自己舒服的节奏呼吸。想走神也没关系，注意到后再轻轻回来。'}
  ],
  thought: [
    {title:'先把事情和想法分开',intro:'只写发生的事，再写脑海里的担心。不必急着判断对错。',placeholder:'比如：明天有数学考试。我担心考不好，就证明自己很差。'},
    {title:'给另一种可能留点空间',intro:'有哪些你知道的事实？有没有事实让这个担心没那么绝对？如果不知道，也可以这样写。',placeholder:'比如：上一次有几道题不会，但也完成了不少题。一次考试不能说明全部。'},
    {title:'写一句你真正相信的话',intro:'不用强迫自己积极。试着写一句既承认困难，也给自己留点空间的话。',placeholder:'比如：我很在乎这次考试。我可以认真准备，也允许自己有不会的题。'}
  ],
  plan: [
    {title:'选一个刚刚好的小行动',intro:'你不需要一次解决所有问题。选一个现在愿意尝试的就好。',choices:['整理明天的考试用品','为复习留一个结束时间','写下一个想问老师的问题','做一点让身体舒服的小事']},
    {title:'让这一步更容易开始',intro:'什么时候、在哪里做？尽量具体，也可以把任务再缩小一点。',placeholder:'比如：今晚吃完饭，在书桌前把笔和准考证放进包里。'},
    {title:'给计划留一点弹性',intro:'如果到时候没有做到，你愿意怎样调整？不需要惩罚自己。',placeholder:'比如：如果太累，就先把笔放进去。剩下的明早再检查。'}
  ]
};
