import type { ExerciseStep, PracticeField, SkillGuide, TrainingModule } from './types.js';

// Transcribed from the four supplied DBT worksheets; each numbered practice is selectable.
export const skillGuides = {
  '参与': {
    title: '参与是什么意思？',
    explanation: '参与就是全身心投入当下正在做的事情。走路就走路，洗碗就洗碗，听歌就听歌——不分心，不旁观自己，不去评判“我做得好不好”。就像看一部很投入的电影，你只是看，完全在里面。',
    examples: ['旁观模式：“我是不是走得太快了？别人会不会觉得我走得很奇怪？”', '参与模式：“走路。感受脚踩在地上，一步一步，向前走。”'],
    methods: ['一心一用：一次只做一件事。', '不评判自己：不去想做得对不对、表现得好不好，只是去做。', '投入到忘了自己：像玩游戏入迷一样，忘了“我在玩”。', '走神了就回来：发现分心，不生气，轻轻回来。'],
    metric: '脑子里的“打转”程度', levels: ['很平静', '有点想', '想挺多', '想很多', '停不下来'],
    reflections: ['完全投入做一件事的时候，你的感觉有什么不同？', '你觉得“参与”最有用的一点是什么？'],
  },
  '观察': {
    title: '观察是什么意思？',
    explanation: '观察就是注意到身体感觉、想法、情绪、冲动，不推开它，也不抓住它，不评价它好不好。像坐在窗边看天空：云来了，你看到了；云走了，你看着它走。不追，也不赶。',
    examples: ['想法像天上飘过的云：只看，不追、不赶。', '情绪像海浪：感受它涌起、退去，站在岸边看。', '想法像传送带：看着它们经过，不抓住、不拦截。', '不推开：不赶走想法，不压制情绪；不抓住：不放大、反复想；只是看到：“哦，我看到了。”'],
    methods: ['用“注意到”开头：“我注意到一个想法飘过来了。”', '给它贴个标签：“这是一个担心”“这是一个回忆”。', '想象它飘走：把想法、情绪想象成云或浪。', '回到身体：想法太快时，先观察脚踩地、呼吸的感觉。'],
    metric: '“淹没感”', levels: ['很平静', '有点满', '比较满', '很满', '被淹没'],
    reflections: ['当你只是“观察”想法、情绪，不追不赶，感觉和平时有什么不同？', '你觉得观察最有用的一点是什么？'],
  },
  '智慧心': {
    title: '智慧心是什么意思？',
    explanation: '情绪心被情绪驱动：“我好生气，不管了！”理性心只看事实和逻辑：“数据显示应该这样选。”智慧心是两者的整合：既看到事实，也承认你的感受，留意内心深处沉静的“知道”。',
    examples: ['情绪心：“我现在好难受、好生气。”', '理性心：“事实是什么？利弊是什么？”', '智慧心：“我既看到事实，也承认我的感受。”'],
    methods: ['把注意力放到呼吸：慢慢吸气、呼气，让注意力跟着呼吸走。', '注意腹部的感觉：把手放在肚子上，留意呼吸起伏。', '安静地问：“我内心深处知道什么是对的？”不硬想，等一等。', '想象一个智慧的朋友：一个了解你、完全关心你的人，会怎么建议？'],
    metric: '纠结 / 拉扯感', levels: ['很清楚', '有点纠结', '比较纠结', '很纠结', '完全拉扯'],
    reflections: ['智慧心给的答案，和情绪心、理性心说的有什么不同？', '你觉得智慧心最有用的一点是什么？'],
  },
  '描述': {
    title: '描述是什么意思？',
    explanation: '描述就是用语言说出体验，不分析为什么，不评判对错，只客观描述发生了什么。区分“事实”和“解读”：事实是你能看见、听见、感觉到的，像摄像头记录；解读是脑子给事实加的故事和猜测。',
    examples: ['解读：“我完蛋了。”', '描述：“我注意到我有一个想法：我完蛋了。”'],
    methods: ['“我注意到我有一个想法：……”——给念头加个框，留出距离。', '“我注意到我感到……”——标注情绪。', '“我的身体有……的感觉。”——描述身体感受，回到当下。', '“我观察到正在发生的是……”——像旁观者一样描述情境。'],
    metric: '难受程度', levels: ['还好', '有点难受', '很难受', '非常难受', '受不了'],
    reflections: ['改写之后，你的感觉有什么不同？', '你觉得描述最有用的一点是什么？'],
  },
} satisfies Record<string, SkillGuide>;

type Category = keyof typeof skillGuides;
const text = (id: string, label: string, placeholder = ''): PracticeField => ({ id, label, placeholder });
const choice = (id: string, label: string, choices: string[], multiple = false): PracticeField => ({ id, label, choices, multiple });
const activities = ['洗碗', '听歌', '散步 / 走路', '看书 / 复习', '吃饭', '画画 / 涂鸦'];
const activityFields = [choice('activity', '选一件你要做的事', activities), text('own', '或者写一件自己的事', '例如：整理书包 / 写作业 / 洗澡……')];
const describeFields = [text('thought', '我注意到我有一个想法：', '写下你的想法……'), text('emotion', '我注意到我感到', '写下你的情绪……'), text('body', '我的身体有……的感觉', '写下身体感受……')];
const decisionFields = [text('decision', '我在纠结的决定是', '例如：要不要跟朋友说这件事 / 要不要回复那条消息……'), text('a', '选 A'), text('b', '选 B')];
const mindsFields = [text('emotion', '情绪心：我的感受在说……', '我觉得害怕 / 生气 / 想要……'), text('reason', '理性心：事实和逻辑在说……', '事实是什么？利弊是什么？')];
const bodyFields = (describe = false) => [
  choice('parts', '你现在注意到哪里有感觉？（多选）', describe ? ['头部 / 脑子', '胸口', '胃 / 肚子', '肩膀', '手 / 手心', '腿 / 脚', '喉咙', '全身'] : ['头部', '胸口', '胃 / 肚子', '肩膀', '手', '腿 / 脚', '喉咙', '整个身体'], true),
  choice('sensations', '是什么样的感觉？（多选）', describe ? ['紧绷', '发热', '发抖', '沉重', '空虚', '刺痛', '心跳很快', '喘不上气', '麻木', '放松'] : ['紧绷', '发热', '发抖', '沉重', '空虚', '跳动', '轻松', '麻木'], true),
];
const breath: ExerciseStep = { title: '呼吸 + 身体安静下来', intro: '跟着提示按舒服的节奏呼吸 1 分钟。吸气时圆圈变大，呼气时变小。把手放在肚子上，留意吸气时腹部鼓起、呼气时腹部落下。想法让它飘过，不追。', prompt: '在心里轻声问：“我内心深处知道什么是对的？”然后等一等，不用硬想。暂时没有答案也可以。', timer: true, durationSeconds: 60, breathing: true };
const settings = { '参与': ['sun', 'peach'], '观察': ['cloud', 'mint'], '智慧心': ['flower', 'lavender'], '描述': ['book', 'mint'] };
function module<const Id extends string>(id: Id, category: Category, title: string, subtitle: string, time: string, steps: ExerciseStep[], stable = false): TrainingModule & { id: Id; guide: SkillGuide } {
  return { id, kind: 'practice', category, title, subtitle, time, icon: settings[category][0], color: settings[category][1], description: subtitle + '。', guide: skillGuides[category],
    useWhen: stable ? '用户愿意时，温和观察当下身体感觉，不要求分析或决定' : `用户情绪平稳、自评困扰不高于 3 分且愿意练习${category}时`,
    ...(stable ? {} : { maxIntensity: 3 }), steps };
}
function lesson<const Id extends string>(id: Id, category: Category) {
  const guide = skillGuides[category];
  return { ...module(id, category, `${category} · 技能讲解`, `认识${category}的含义、例子和练习方法`, '3 分钟', [
    { title: guide.title, intro: guide.explanation, prompt: '可以慢慢读，按自己的节奏了解这个技能。' },
    { title: `${category}：看看这些例子`, intro: '通过这些例子，看看这个技能在日常生活中是什么样的。', examples: guide.examples },
    { title: `${category}：可以试试的方法`, intro: '从下面的方法中，选一个你觉得容易上手的。阅读后，可以到同一分类里选一个小练习。', examples: guide.methods },
  ], true), kind: 'guide' as const, useWhen: `用户希望了解${category}技能的含义和方法时，可阅读这份独立讲解` };
}
function daily(category: Category, moments: string[]): ExerciseStep[] {
  return moments.map((moment, i) => ({ title: ['早上的 1 分钟', '中午的 1 分钟', '晚上的 1 分钟'][i], intro: moment, prompt: `${category}：一天 3 次，每次 1 分钟。在相应的时刻尝试，也可以先写下今天的安排。`, timer: true, durationSeconds: 60, fields: [text('note', '这一次的体验或安排', '准备什么时候练？注意到了什么？')] }));
}

export const dbtModules = [
  lesson('participate-guide', '参与'),
  module('participate-activity', '参与', '选一件你要做的事', '可以从任何日常小事开始', '2 分钟', [
    { title: '选一件你要做的事', intro: '选一件你马上要做的事，或写一件自己的。不用挑特别的事，越普通越好。', fields: activityFields },
    { title: '一心一用，去做这件事', intro: '只做你选的那件事，不评判“我做得好不好”。', prompt: '发现走神了，不生气，轻轻回到正在做的事。', fields: [text('note', '你想怎么投入这件事？')] },
  ]),
  module('participate-immersion', '参与', '1 分钟沉浸体验', '先从 1 分钟开始，投入做你选的事', '1 分钟', [
    { title: '选一件普通的小事', intro: '如果已经选好了，可以继续做那件事；也可以重新选一件。', fields: activityFields },
    { title: '1 分钟沉浸体验', intro: '点开始，全身心去做你选的事。不评判，发现走神就回来。', examples: ['洗碗：感受水温、手上的泡沫、碗的光滑。', '听歌：听每一个音符、鼓点、歌手的声音。', '走路：感受脚踩地、空气的温度、周围声音。', '看书：留意每个字的意思，像听人讲故事。', '吃饭：留意味道、咀嚼的口感、咽下去的感觉。'], timer: true, durationSeconds: 60 },
  ]),
  module('participate-senses', '参与', '五感投入检查', '用五种感官帮你投入正在做的事', '3 分钟', [
    { title: '五感投入检查', intro: '用五感把自己拉进当下。写下做这件事时每种感官感受到了什么，没有注意到的可以留空。', fields: ['看', '听', '闻', '尝', '触'].map((label, i) => text(`sense-${i}`, label)) },
  ]),
  module('participate-counter', '参与', '走神计数器', '走神不可怕，看到了回来就好', '2 分钟', [
    { title: '走神计数器', intro: '做 2 分钟你选的事。每次发现走神了（想别的事、评判自己），点一下“+”，不生气，回来继续。', prompt: '走神了 ≠ 失败。发现走神本身就是一次成功。数字多也没关系，重点是“回来”。', timer: true, durationSeconds: 120, counter: '我走神了……回来继续', fields: [text('thought', '走神的时候，你想了什么？', '例如：在想明天的事 / 别人怎么看我 / 在担心……')] },
  ]),
  module('participate-rating', '参与', '沉浸程度打分', '看看你投入了多少', '2 分钟', [
    { title: '沉浸程度打分', intro: '回想刚才做一件事的体验，选出你的沉浸程度。', fields: [choice('rating', '你的沉浸程度', ['完全没投入', '有点投入', '还行', '比较投入', '完全沉浸']), choice('obstacles', '什么让你最难投入？（多选）', ['脑子里停不下来', '担心别人的看法', '觉得这件事无聊', '手机在旁边', '身体不舒服', '情绪太强烈', '其他想法不断冒出来'], true), text('next', '下次想试试什么方法让自己更投入？', '例如：把手机放远一点 / 做之前深呼吸三次……')] },
  ]),
  module('participate-daily', '参与', '参与 · 今天的小练习', '一天 3 次，每次 1 分钟', '3 × 1 分钟', daily('参与', ['刷牙的时候，只管刷牙。', '吃午饭的时候，只管吃饭。', '洗澡的时候，只管洗澡。'])),
  lesson('observe-guide', '观察'),
  module('observe-clouds', '观察', '想法云朵练习', '把想法当成天上飘过的云，只看不追', '3 分钟', [
    { title: '想法像云一样飘过', intro: '想象坐在草地上抬头看天空。这些想法像云一样飘过。每朵云经过时默念：“我注意到一个想法飘过来了。”只看，不追、不赶。', examples: ['我完蛋了', '他是不是讨厌我', '明天的事怎么办', '我怎么什么都做不好', '上次那件事好丢人', '好累，不想动了', '大家都在看我'], prompt: '云会自己飘走。你只需要看，不用做任何事。' },
    { title: '哪朵云你想追 / 想赶走？', intro: '写下刚才最吸引你注意的“想法云”。', prompt: '发现自己反复想某个想法时，对自己说：“我注意到我又在追这朵云了。”然后回到天空，看下一朵。', fields: [text('cloud', '最吸引我的想法云')] },
  ]),
  module('observe-body', '观察', '身体感觉观察', '想法太快的时候，先从身体入手', '2 分钟', [
    { title: '注意此刻的身体', intro: '当脑子太快、太满时，先观察身体。留意此刻能注意到的部位和感觉。', fields: bodyFields() },
    { title: '只是观察，不急着改变', intro: '留意这些感觉是强是弱、在变还是没变。不需要改变它，只要注意到就好。', prompt: '用“我观察到我的身体有……的感觉”“我注意到这种感觉……”写下来。', timer: true, durationSeconds: 60 },
    { title: '用“观察到”写下来', intro: '描述你刚才观察到的身体感觉。', fields: [text('body', '我观察到我的身体有……的感觉'), text('change', '我注意到这种感觉……', '强 / 弱 / 在变 / 没变')] },
  ], true),
  module('observe-labels', '观察', '给想法贴标签', '像分类一样标注，不被内容淹没', '3 分钟', [
    { title: '给想法贴标签', intro: '不用判断想法内容对不对，只给它贴个标签。像快递分拣：只写“这是一本书”，不拆开读。', prompt: '贴完标签，想象它是一朵云，看着它飘走。不用解决、分析、回答它；放回传送带就行。', fields: [choice('labels', '你现在脑子里有哪些标签？（多选）', ['这是一个担心', '这是一个回忆', '这是一个评判', '这是一个计划', '这是一个想象', '这是一个自我批评', '这是一个预演', '这是一个旧对话'], true), text('thought', '把你的想法贴上标签写出来', '我注意到一个担心：……\n我注意到一个回忆：……\n我注意到一个评判：……')] },
  ]),
  module('observe-urge', '观察', '冲动冲浪', '观察一个冲动，看它怎么涨起来又退下去', '3 分钟', [
    { title: '观察冲动的浪', intro: '冲动像海浪，会涨起来、到顶、退下。不用立刻去做，也不用压制它，只观察它。', prompt: '给冲动一点时间，留意它的变化；不要求它立刻消失。', fields: [text('urge', '你现在有一个什么冲动？（不用去做，只写下来）', '例如：想吃东西 / 想刷手机 / 想发脾气 / 想逃避……'), choice('wave', '观察这个冲动的“浪”', ['它现在在涨起来（越来越强）', '它在顶点（最强的时候）', '它在退下去（变弱了）', '我不确定它在哪里'])] },
  ]),
  module('observe-counter', '观察', '“注意到”计数器', '2 分钟内，数你注意到了多少个东西', '2 分钟', [
    { title: '“注意到”计数器', intro: '设 2 分钟。每当注意力碰到一个想法、感觉、声音、情绪，就点“+”，心里说“注意到了”，然后让它走。', prompt: '每次“注意到”都是一次成功。是在数你回来了多少次，不需要追求某个数字。', timer: true, durationSeconds: 120, counter: '我注意到了……让它走', fields: [choice('types', '你注意到了哪些类型？（多选）', ['身体感觉', '想法', '情绪', '声音', '画面', '冲动', '味道 / 气味'], true), text('hardest', '最难让它走的是哪个？', '写下最难“放手”的那个……')] },
  ]),
  module('observe-daily', '观察', '观察 · 今天的小练习', '一天 3 次，每次 1 分钟', '3 × 1 分钟', daily('观察', ['刷牙时，观察嘴里泡沫的感觉。', '走路时，观察脚踩地的感觉。', '睡前，观察呼吸的一进一出。'])),
  lesson('wise-guide', '智慧心'),
  module('wise-decision', '智慧心', '你现在需要做一个什么决定？', '先把纠结的事情写下来', '3 分钟', [
    { title: '写下你纠结的决定', intro: '想一个现在让你有点为难、不大不小的决定，先写下来，再列出两个选择。', fields: decisionFields },
  ]),
  module('wise-minds', '智慧心', '三种脑分类', '看看情绪心和理性心各自在说什么', '5 分钟', [
    { title: '先分开看', intro: '选一个纠结的决定，分别写下情绪心和理性心的声音。智慧心先空着，安静下来后再填。', fields: [text('decision', '我在纠结的决定是'), ...mindsFields] },
    breath,
    { title: '整合成智慧心', intro: '既承认感受，也看到事实。留意有没有一种沉静的知道，不用强迫答案出现。', fields: [text('wisdom', '智慧心：我内心深处知道……')] },
  ]),
  module('wise-breathing', '智慧心', '呼吸 + 身体安静下来', '给智慧心一点安静的空间', '1 分钟', [breath]),
  module('wise-friend', '智慧心', '智慧朋友来信', '想象一个完全懂你、完全关心你的人', '5 分钟', [
    { title: '来自你的智慧朋友', intro: '想象一个了解你所有感受和事实、无条件关心你的朋友。他 / 她会怎么跟你说？写下这封来信。', fields: [text('decision', '我知道你正在纠结……'), text('emotion', '我理解你的感受（情绪心）'), text('reason', '我也看到了事实（理性心）'), text('advice', '我想给你的建议是……', '—— 你的智慧朋友')] },
  ]),
  module('wise-integration', '智慧心', '智慧心说了什么？', '整合情绪与事实，找到具体的一小步', '5 分钟', [
    { title: '回顾情绪和事实', intro: '如果还没做前面的练习，可以在这里写下决定、感受和事实。', fields: [text('decision', '我在纠结的决定是'), ...mindsFields] },
    breath,
    { title: '智慧心说了什么？', intro: '安静下来后，留意内心深处有没有一个答案。智慧心常带着沉静的知道：承认感受，也看到事实。没有答案可以再等等。', fields: [text('wisdom', '我的智慧心说', '我内心深处知道……'), text('action', '基于智慧心，我打算这么做', '具体的一小步……')] },
  ]),
  module('wise-quick', '智慧心', '30 秒智慧心速查', '日常小事也可以用', '30 秒', [
    { title: '30 秒智慧心速查', intro: '跟着呼吸 30 秒，然后问问自己。', examples: ['深呼吸 3 次，把手放在肚子上。', '轻声问：“我内心知道什么是对的？”', '等答案浮现，不硬想。有了之后，选择自己愿意做的一小步。'], timer: true, durationSeconds: 30, breathing: true, fields: [text('wisdom', '此刻浮现的答案（可以留空）')] },
  ]),
  lesson('describe-guide', '描述'),
  module('describe-facts', '描述', '区分事实和解读', '像摄像头一样看事情', '3 分钟', [
    { title: '事实：像摄像头一样记录', intro: '想一个最近让你难受的情境。先写只有你能看到、听到的事实。', fields: [text('fact', '事实（像摄像头一样记录）', '例如：老师看了我一眼，没有说话……')] },
    { title: '解读：脑子加的故事', intro: '再写脑子自动给事实加的故事和猜测。', fields: [text('interpretation', '解读（你的脑子自动加的故事）', '例如：老师讨厌我，我肯定要挂了……')] },
    { title: '看看事实和解读的不同', intro: '哪些是摄像头能记录的？哪些是你的猜测？不用评判自己，只把它们分开。', fields: [text('difference', '我注意到的区别')] },
  ]),
  module('describe-rewrite', '描述', '用描述句式改写', '把解读改写，加上“我注意到”', '3 分钟', [
    { title: '用描述句式改写', intro: '把一个让你难受的解读改写，像给它套上一层玻璃罩。如果已经写了“事实和解读”，可以继续用那个情境。', fields: [text('original', '原来的解读'), ...describeFields] },
  ]),
  module('describe-body', '描述', '身体感受扫描', '描述此刻你身体哪里有感觉', '3 分钟', [
    { title: '身体感受扫描', intro: '不只描述想法，也描述身体。选出此刻有感觉的部位和感受类型。', fields: bodyFields(true) },
    { title: '用一句话描述身体感觉', intro: '只描述此刻感受到的，不分析原因，也不评判好坏。', fields: [text('body', '用一句话描述你的身体感觉', '例如：我的胸口有紧绷的感觉……')] },
  ]),
  module('describe-scenario', '描述', '换个情境再试一次', '练习越多，描述就越自然', '3 分钟', [
    { title: '选一个情境', intro: '从下面选一个情境，或写你自己的。用描述句式再试一次。', fields: [choice('scenario', '选择情境', ['朋友没回我消息，等了很久', '考试前觉得很紧张', '和家人吵架之后', '晚上睡不着，脑子里停不下来']), text('own', '其他（自己写）')] },
    { title: '用句式描述这个情境', intro: '把想法、情绪、身体感觉用语言标注出来。', fields: describeFields },
  ]),
  module('describe-daily', '描述', '描述 · 今天的小练习', '一天 3 次，每次 1 分钟', '3 × 1 分钟', daily('描述', ['起床后，描述一下你现在的感受。', '中午，描述一下上午发生了什么。', '睡前，描述一下今天的一个想法。'])),
];

export type StepAnswer = Record<string, string | string[] | number>;
export function serializePractice(steps: ExerciseStep[], answers: StepAnswer[]): string {
  return steps.flatMap((step, index) => {
    const values = answers[index] || {};
    const lines = (step.fields || []).flatMap(field => {
      const value = values[field.id];
      const content = Array.isArray(value) ? value.join('、') : String(value ?? '').trim();
      return content ? [`${field.label}：${content}`] : [];
    });
    if (step.counter) lines.push(`${step.counter}：${values.count ?? 0} 次`);
    return lines.length ? [`${step.title}\n${lines.join('\n')}`] : [];
  }).join('\n\n');
}
