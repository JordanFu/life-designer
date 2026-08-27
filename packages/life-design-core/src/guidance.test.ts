import { describe, expect, it } from 'vitest'
import type { HereGuidance } from './checkpoint'
import {
  buildHereReflection,
  problemOptionsFor,
  recommendFocus,
} from './guidance'

const completeDraft: HereGuidance = {
  currentMicroStepId: 'here.summary',
  scores: { health: 6, work: 2, play: 4, love: 8 },
  focus: 'work',
  problemShapeId: 'work.direction',
  problemStatement: '最近我最困扰的是：我想换方向，但不知道该往哪里走。',
  momentWindow: 'this-week',
  momentDetails: '周一开会时，我发现自己对接下来的项目完全提不起兴趣。',
  feelings: ['tired', 'lost'],
  feelingNote: '',
  boundaryType: 'mixed',
  nextAction: '约一位不同岗位的朋友聊聊真实工作日常。',
}

describe('guided first-stage content', () => {
  it('recommends the two lowest dashboard dimensions in stable order', () => {
    expect(recommendFocus({ health: 6, work: 2, play: 2, love: 8 })).toEqual([
      'work',
      'play',
    ])
  })

  it('offers concrete problem shapes for the selected focus', () => {
    const options = problemOptionsFor('work')

    expect(options.map((item) => item.id)).toContain('work.direction')
    expect(options.at(-1)?.id).toBe('work.other')
  })

  it('builds a transparent, non-diagnostic reflection from the answers', () => {
    const reflection = buildHereReflection(completeDraft)

    expect(reflection).toContain('我听到的是')
    expect(reflection).toContain('工作')
    expect(reflection).toContain(completeDraft.momentDetails)
    expect(reflection).toContain('疲惫、迷茫')
    expect(reflection).toContain('可能')
    expect(reflection).not.toContain('最近最困扰你的是“最近我最困扰的是')
    expect(reflection).not.toContain('诊断')
  })
})
