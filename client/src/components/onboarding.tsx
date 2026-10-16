'use client';

import { Modal } from './practice-ui';

export function Onboarding({ onAccept }: { onAccept: () => void }) {
  return <Modal label="BEFORE YOU BEGIN · 使用前说明" title="欢迎来到心晴" onClose={() => {}} dismissible={false}
    actions={<button className="primary onboarding-accept" onClick={onAccept}>我明白，进入心晴 ↗</button>}>
    <p className="intro">心晴面向 14–18 岁青少年，帮助你练习情绪调节、整理想法和人际表达。</p>
    <div className="onboarding-points">
      <p><strong>它是一位技能教练</strong><span>不提供疾病诊断、心理治疗或药物建议。</span></p>
      <p><strong>你可以自己决定</strong><span>随时暂停练习，不想填写的内容可以留空。</span></p>
      <p><strong>需要帮助时优先找现实中的人</strong><span>有紧急危险或无法保证安全时，请联系可信任的成年人或紧急服务。</span></p>
      <p><strong>账户的数据方式</strong><span>记录、对话和使用说明确认状态保存在服务器，登录同一账户可在其他设备查看。授权管理员可管理这些数据；主动发送的文字及必要的近期对话会提交给配置的模型服务。</span></p>
    </div>
  </Modal>;
}
