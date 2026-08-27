import { hereGuidanceSchema, type DashboardResponse, type HereGuidance } from './checkpoint'

export type FocusKey = keyof DashboardResponse['scores']

export type GuidanceOption = {
  id: string
  label: string
  note: string
}

export const hereMicroStepOrder = [
  'here.welcome',
  'here.dashboard',
  'here.focus',
  'here.problem-shape',
  'here.moment-when',
  'here.moment-event',
  'here.feelings',
  'here.boundaries',
  'here.summary',
] as const

export const focusLabels: Record<FocusKey, string> = {
  health: '健康',
  work: '工作',
  play: '娱乐',
  love: '爱与连接',
}

export const dashboardAnchors = [
  { min: 0, max: 2, label: '已经明显影响日常' },
  { min: 3, max: 5, label: '勉强维持，需要关注' },
  { min: 6, max: 8, label: '整体稳定，偶有波动' },
  { min: 9, max: 10, label: '很满意，希望保持' },
] as const

export const feelingOptions = [
  { id: 'anxious', label: '焦虑' },
  { id: 'tired', label: '疲惫' },
  { id: 'lost', label: '迷茫' },
  { id: 'angry', label: '生气' },
  { id: 'sad', label: '难过' },
  { id: 'numb', label: '麻木' },
  { id: 'lonely', label: '孤单' },
  { id: 'hopeful', label: '仍有期待' },
] as const

export const boundaryOptions = [
  { id: 'direct', label: '我能直接尝试改变', note: '先调整自己的行动、安排或选择' },
  { id: 'influence', label: '我能影响，但不能完全控制', note: '需要沟通、协商或争取支持' },
  { id: 'gravity', label: '短期内只能接受或绕开', note: '现实暂时不会因为努力而消失' },
  { id: 'mixed', label: '这里面三种情况都有', note: '先从最小的可行动部分开始' },
] as const

const problemOptions: Record<FocusKey, GuidanceOption[]> = {
  health: [
    { id: 'health.exhausted', label: '总是很累', note: '休息了也很难真正恢复' },
    { id: 'health.body', label: '身体在提醒我', note: '疼痛、不适或睡眠已经影响日常' },
    { id: 'health.mood', label: '情绪起伏很大', note: '焦虑、低落或烦躁越来越频繁' },
    { id: 'health.routine', label: '生活节奏失控', note: '饮食、运动或作息很难稳定' },
    { id: 'health.care', label: '不知道如何开始照顾自己', note: '知道要改变，却一直没有行动' },
    { id: 'health.other', label: '都不准确，我自己说', note: '用你自己的语言描述' },
  ],
  work: [
    { id: 'work.overload', label: '总在透支', note: '工作量或节奏让我难以恢复' },
    { id: 'work.meaning', label: '看不到意义', note: '完成很多事情，却没有价值感' },
    { id: 'work.direction', label: '想换方向但不知道去哪', note: '现在不合适，下一步也不清楚' },
    { id: 'work.growth', label: '能力没有发挥', note: '缺少成长、挑战或被需要的感觉' },
    { id: 'work.relationships', label: '人际或环境让我难受', note: '关系、文化或管理方式持续消耗我' },
    { id: 'work.other', label: '都不准确，我自己说', note: '用你自己的语言描述' },
  ],
  play: [
    { id: 'play.no-time', label: '完全没有自己的时间', note: '每天都被任务和责任占满' },
    { id: 'play.guilty', label: '一放松就有负罪感', note: '休息时也觉得自己应该做点什么' },
    { id: 'play.bored', label: '很久没有真正开心', note: '娱乐更像麻木，而不是恢复' },
    { id: 'play.isolated', label: '缺少一起玩的人', note: '想连接，但总是一个人' },
    { id: 'play.forgotten', label: '忘了自己喜欢什么', note: '已经想不起上次投入爱好是什么时候' },
    { id: 'play.other', label: '都不准确，我自己说', note: '用你自己的语言描述' },
  ],
  love: [
    { id: 'love.conflict', label: '冲突反复发生', note: '同样的问题一次次出现' },
    { id: 'love.distance', label: '关系正在变远', note: '相处还在，真实交流却变少了' },
    { id: 'love.loneliness', label: '身边有人，还是孤单', note: '很少感到被理解或被支持' },
    { id: 'love.boundaries', label: '很难说不', note: '总在照顾别人，却忽略自己' },
    { id: 'love.care-load', label: '照顾责任让我透支', note: '家人或关系需要很多精力' },
    { id: 'love.other', label: '都不准确，我自己说', note: '用你自己的语言描述' },
  ],
}

const focusOrder: FocusKey[] = ['health', 'work', 'play', 'love']

const timeLabels: Record<NonNullable<HereGuidance['momentWindow']>, string> = {
  today: '今天',
  'this-week': '这周',
  'this-month': '这个月',
  longer: '更早以前',
}

const feelingLabels = Object.fromEntries(
  feelingOptions.map((item) => [item.id, item.label]),
) as Record<HereGuidance['feelings'][number], string>

const boundaryLabels = Object.fromEntries(
  boundaryOptions.map((item) => [item.id, item.label]),
) as Record<NonNullable<HereGuidance['boundaryType']>, string>

export function dashboardAnchor(score: number): string {
  return dashboardAnchors.find((anchor) => score >= anchor.min && score <= anchor.max)?.label ?? ''
}

export function recommendFocus(scores: DashboardResponse['scores']): FocusKey[] {
  return [...focusOrder]
    .sort((left, right) => scores[left] - scores[right] || focusOrder.indexOf(left) - focusOrder.indexOf(right))
    .slice(0, 2)
}

export function problemOptionsFor(focus: FocusKey): GuidanceOption[] {
  return problemOptions[focus]
}

export function problemOptionFor(focus: FocusKey, id: string): GuidanceOption | undefined {
  return problemOptions[focus].find((item) => item.id === id)
}

export function buildHereReflection(input: HereGuidance): string {
  const draft = hereGuidanceSchema.parse(input)
  if (
    !draft.focus ||
    !draft.problemStatement ||
    !draft.momentWindow ||
    !draft.momentDetails ||
    draft.feelings.length === 0 ||
    !draft.boundaryType ||
    !draft.nextAction
  ) {
    throw new Error('Guided first-stage answers are incomplete')
  }

  const feelings = draft.feelings.map((item) => feelingLabels[item]).join('、')
  const feelingNote = draft.feelingNote ? `，你还补充说“${draft.feelingNote}”` : ''

  return `我听到的是：你现在最想关注的是${focusLabels[draft.focus]}。最近最困扰你的是“${draft.problemStatement}”。${timeLabels[draft.momentWindow]}，${draft.momentDetails}，那一刻你感到${feelings}${feelingNote}。你判断这件事“${boundaryLabels[draft.boundaryType]}”，这可能意味着，与其一次解决整个人生，更值得先验证一个能行动的小问题。你愿意先做的是：${draft.nextAction}。这只是根据你刚才的回答整理出的草稿，是否准确由你决定。`
}
