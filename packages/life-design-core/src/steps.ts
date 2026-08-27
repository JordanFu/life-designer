import type { LifeDesignStage, StepId } from './checkpoint'

export type StepKind = 'dashboard' | 'text' | 'energy-map' | 'odyssey-plans' | 'prototype'

export type LifeDesignStep = {
  id: StepId
  stage: Exclude<LifeDesignStage, 'complete'>
  kind: StepKind
  title: string
  prompt: string
  hint: string
}

export const stageLabels: Record<Exclude<LifeDesignStage, 'complete'>, string> = {
  here: '你在这里',
  compass: '你的指南针',
  wayfinding: '寻路',
  odyssey: '多种可能',
}

export const steps: readonly LifeDesignStep[] = [
  {
    id: 'here.dashboard',
    stage: 'here',
    kind: 'dashboard',
    title: '四个仪表盘',
    prompt: '此刻的健康、工作、娱乐和爱，各自处在什么位置？',
    hint: '凭第一感觉打分即可。分数不是评价，只是帮你看清哪里最需要关注。',
  },
  {
    id: 'here.primary-problem',
    stage: 'here',
    kind: 'text',
    title: '此刻最想解决的问题',
    prompt: '现在最让你焦虑、也最想改变的那个人生问题是什么？',
    hint: '先写你脑中最直接的版本，不需要马上判断它是否能被解决。',
  },
  {
    id: 'here.why-now',
    stage: 'here',
    kind: 'text',
    title: '为什么是现在',
    prompt: '最近发生了哪一件具体的事，让这个问题变得不能再忽略？',
    hint: '尽量写一个真实场景：发生了什么、当时在哪里、你有什么感受。',
  },
  {
    id: 'compass.workview',
    stage: 'compass',
    kind: 'text',
    title: '你的工作观',
    prompt: '工作对你到底意味着什么？你为什么要工作？',
    hint: '先不讨论具体职业，写工作与金钱、成长、他人和世界的关系。',
  },
  {
    id: 'compass.lifeview',
    stage: 'compass',
    kind: 'text',
    title: '你的人生观',
    prompt: '你希望怎样度过这一生？什么会让你觉得这一生没有白过？',
    hint: '可以写家人、创造、体验、影响、自由或任何真正重要的东西。',
  },
  {
    id: 'wayfinding.energy-map',
    stage: 'wayfinding',
    kind: 'energy-map',
    title: '你的能量地图',
    prompt: '回忆三个近期做过的具体活动，它们怎样影响你的能量和投入感？',
    hint: '活动越具体越好，例如“主持周会”比“工作”更有用。',
  },
  {
    id: 'odyssey.plans',
    stage: 'odyssey',
    kind: 'odyssey-plans',
    title: '三个五年版本',
    prompt: '设计三个完全不同、但你都真心愿意尝试的五年人生版本。',
    hint: '三个都是 A 计划。第二个不是退路，第三个也不是不切实际的幻想。',
  },
  {
    id: 'odyssey.prototype',
    stage: 'odyssey',
    kind: 'prototype',
    title: '先做一个小实验',
    prompt: '从一个版本里选出本月可以验证的核心问题。',
    hint: '不是立刻辞职或搬家，而是用访谈、体验或小作品获得真实信息。',
  },
] as const

export function getStep(stepId: StepId | null): LifeDesignStep | null {
  return steps.find((step) => step.id === stepId) ?? null
}
