import { describe, expect, it } from 'vitest'
import type { HereGuidance, StepId } from './checkpoint'
import { steps } from './steps'
import {
  advanceAfterSavedResponse,
  beginBlueprint,
  completeBlueprint,
  completeCoachMoment,
  completeHereGuidance,
  createCheckpoint,
  failBlueprint,
  goBackHereGuidance,
  isReadyForBlueprint,
  migrateCheckpoint,
  recordCoachTurn,
  recordResponse,
  recoverInterruptedBlueprint,
  saveHereGuidance,
  skipCoachMoment,
} from './session'

const startedAt = '2026-08-27T08:00:00.000Z'
const answeredAt = '2026-08-27T08:01:00.000Z'

const completeHereDraft: HereGuidance = {
  currentMicroStepId: 'here.summary',
  scores: { health: 6, work: 2, play: 4, love: 8 },
  focus: 'work',
  problemShapeId: 'work.direction',
  problemStatement: '我想换方向，但不知道该往哪里走。',
  momentWindow: 'this-week',
  momentDetails: '周一开会时，我发现自己对接下来的项目完全提不起兴趣。',
  feelings: ['tired', 'lost'],
  feelingNote: '',
  boundaryType: 'mixed',
  nextAction: '约一位不同岗位的朋友聊聊真实工作日常。',
}

describe('four-stage life-design session', () => {
  it('starts a v4 checkpoint at the guided welcome micro-step', () => {
    const checkpoint = createCheckpoint('session-1', startedAt)

    expect(checkpoint.schemaVersion).toBe(4)
    expect(checkpoint.hereGuidance).toMatchObject({
      currentMicroStepId: 'here.welcome',
      feelings: [],
      feelingNote: '',
    })
    expect(checkpoint.currentStepId).toBe('here.dashboard')
    expect(checkpoint.coachPendingAfter).toBeNull()
    expect(checkpoint.coachTurns).toEqual([])
    expect(checkpoint.blueprint).toEqual({ status: 'idle' })
  })

  it('saves and returns between guided micro-steps without losing answers', () => {
    const created = createCheckpoint('session-1', startedAt)
    const initial = {
      ...created,
      hereGuidance: {
        currentMicroStepId: 'here.focus' as const,
        scores: completeHereDraft.scores,
        feelings: [],
        feelingNote: '',
      },
    }
    const focused = saveHereGuidance(
      initial,
      {
        currentMicroStepId: 'here.problem-shape',
        scores: completeHereDraft.scores,
        focus: 'work',
        feelings: [],
        feelingNote: '',
      },
      answeredAt,
    )

    expect(focused.revision).toBe(initial.revision + 1)
    expect(focused.hereGuidance?.focus).toBe('work')

    const previous = goBackHereGuidance(focused, '2026-08-27T08:02:00.000Z')
    expect(previous.hereGuidance?.currentMicroStepId).toBe('here.focus')
    expect(previous.hereGuidance?.scores).toEqual(completeHereDraft.scores)
    expect(previous.hereGuidance?.focus).toBe('work')
  })

  it('atomically turns a confirmed reflection into the three canonical here responses', () => {
    const initial = createCheckpoint('session-1', startedAt)
    const ready = {
      ...initial,
      hereGuidance: completeHereDraft,
    }
    const reflection = '我听到的是：你想重新寻找更适合自己的工作方向，并先通过一次真实访谈获得信息。'
    const completed = completeHereGuidance(ready, reflection, answeredAt)

    expect(completed.currentStepId).toBe('compass.workview')
    expect(completed.stage).toBe('compass')
    expect(completed.hereGuidance).toBeNull()
    expect(completed.stageReflections.here).toBe(reflection)
    expect(completed.completedStepIds).toEqual(
      expect.arrayContaining(['here.dashboard', 'here.primary-problem', 'here.why-now']),
    )
    expect(completed.responses.filter((item) => item.stepId.startsWith('here.'))).toHaveLength(3)
    expect(completed.coachPendingAfter).toBe('here.guided')
  })

  it('migrates a partially completed v2 session to the first missing guided moment', () => {
    const migrated = migrateCheckpoint(
      {
        schemaVersion: 2,
        sessionId: 'v2-session',
        revision: 4,
        createdAt: startedAt,
        updatedAt: answeredAt,
        stage: 'here',
        currentStepId: 'here.why-now',
        completedStepIds: ['here.dashboard', 'here.primary-problem'],
        responses: [
          {
            stepId: 'here.dashboard',
            kind: 'dashboard',
            scores: completeHereDraft.scores,
          },
          {
            stepId: 'here.primary-problem',
            kind: 'text',
            text: completeHereDraft.problemStatement,
          },
        ],
        pendingOperation: null,
        legacyNotes: [],
      },
      '2026-08-27T09:00:00.000Z',
    )

    expect(migrated.schemaVersion).toBe(4)
    expect(migrated.responses).toHaveLength(2)
    expect(migrated.hereGuidance).toMatchObject({
      currentMicroStepId: 'here.moment-when',
      scores: completeHereDraft.scores,
      focus: 'work',
      problemStatement: completeHereDraft.problemStatement,
    })
  })

  it('uses eight canonical mixed-input steps across four stages', () => {
    expect(steps.map((step) => step.id)).toEqual([
      'here.dashboard',
      'here.primary-problem',
      'here.why-now',
      'compass.workview',
      'compass.lifeview',
      'wayfinding.energy-map',
      'odyssey.plans',
      'odyssey.prototype',
    ])
    expect(new Set(steps.map((step) => step.stage))).toEqual(
      new Set(['here', 'compass', 'wayfinding', 'odyssey']),
    )
  })

  it('records a typed dashboard before changing the current step', () => {
    const initial = createCheckpoint('session-1', startedAt)
    const saved = recordResponse(
      initial,
      {
        stepId: 'here.dashboard',
        kind: 'dashboard',
        scores: { health: 6, work: 3, play: 4, love: 8 },
      },
      answeredAt,
    )

    expect(saved.currentStepId).toBe('here.dashboard')
    expect(saved.responses[0]).toMatchObject({ kind: 'dashboard' })
    expect(saved.pendingOperation).toEqual({
      type: 'advance-step',
      stepId: 'here.dashboard',
    })
    expect(saved.coachPendingAfter).toBe('here.dashboard')
    expect(isReadyForBlueprint(saved)).toBe(false)
  })

  it('rejects a response for a step other than the current step', () => {
    const initial = createCheckpoint('session-1', startedAt)
    expect(() =>
      recordResponse(
        initial,
        { stepId: 'here.primary-problem', kind: 'text', text: '工作让我最焦虑。' },
        answeredAt,
      ),
    ).toThrow('Response does not match the current step')
  })

  it('advances stage from the canonical step order', () => {
    let checkpoint = createCheckpoint('session-1', startedAt)
    const responses = [
      {
        stepId: 'here.dashboard' as const,
        kind: 'dashboard' as const,
        scores: { health: 6, work: 3, play: 4, love: 8 },
      },
      {
        stepId: 'here.primary-problem' as const,
        kind: 'text' as const,
        text: '工作让我最焦虑。',
      },
      {
        stepId: 'here.why-now' as const,
        kind: 'text' as const,
        text: '最近持续失眠。',
      },
    ]

    for (const response of responses) {
      checkpoint = recordResponse(checkpoint, response, answeredAt)
      checkpoint = skipCoachMoment(checkpoint, answeredAt)
    }

    expect(checkpoint.currentStepId).toBe('compass.workview')
    expect(checkpoint.stage).toBe('compass')
  })

  it('retains Stage 0 answers as legacy notes without unlocking completion', () => {
    const migrated = migrateCheckpoint(
      {
        schemaVersion: 1,
        sessionId: 'legacy-session',
        revision: 7,
        createdAt: startedAt,
        updatedAt: answeredAt,
        stage: 'here',
        currentQuestionId: null,
        completedQuestionIds: ['here.dashboard', 'here.primary-problem', 'here.why-now'],
        answers: [
          { questionId: 'here.dashboard', text: '工作 3 分。', answeredAt },
          { questionId: 'here.primary-problem', text: '工作让我焦虑。', answeredAt },
          { questionId: 'here.why-now', text: '最近总失眠。', answeredAt },
        ],
        pendingOperation: null,
      },
      '2026-08-27T09:00:00.000Z',
    )

    expect(migrated.schemaVersion).toBe(4)
    expect(migrated.currentStepId).toBe('here.dashboard')
    expect(migrated.hereGuidance?.currentMicroStepId).toBe('here.welcome')
    expect(migrated.legacyNotes).toEqual([
      '工作 3 分。',
      '工作让我焦虑。',
      '最近总失眠。',
    ])
    expect(migrated.responses).toEqual([])
    expect(isReadyForBlueprint(migrated)).toBe(false)
  })

  it('keeps the canonical cursor still until the saved coach moment is completed', () => {
    const initial = {
      ...createCheckpoint('coach-session', startedAt),
      hereGuidance: null,
      stage: 'compass' as const,
      currentStepId: 'compass.workview' as const,
      completedStepIds: ['here.dashboard', 'here.primary-problem', 'here.why-now'] as StepId[],
    }
    const recorded = recordResponse(
      initial,
      { stepId: 'compass.workview', kind: 'text', text: '工作是创造价值和保持自主。' },
      answeredAt,
    )
    expect(recorded.currentStepId).toBe('compass.workview')
    expect(recorded.coachPendingAfter).toBe('compass.workview')

    const withTurn = recordCoachTurn(
      recorded,
      {
        acknowledgement: '你把工作看成创造价值的方式，同时也很看重自主。',
        insight: '这里可能存在自主与稳定之间需要被看见的拉扯。',
        followUp: '最近哪一次工作让你感到这两者同时出现？',
      },
      '2026-08-27T08:02:00.000Z',
    )
    expect(withTurn.currentStepId).toBe('compass.workview')
    expect(withTurn.coachPendingAfter).toBe('compass.workview')

    const advanced = completeCoachMoment(
      withTurn,
      '上个月的一次跨团队产品项目。',
      '2026-08-27T08:03:00.000Z',
    )
    expect(advanced.currentStepId).toBe('compass.lifeview')
    expect(advanced.coachPendingAfter).toBeNull()
    expect(advanced.coachTurns.at(-1)?.followUpAnswer).toBe('上个月的一次跨团队产品项目。')
  })

  it('can skip a failed coach response without losing or duplicating the saved answer', () => {
    const initial = {
      ...createCheckpoint('skip-session', startedAt),
      hereGuidance: null,
      stage: 'compass' as const,
      currentStepId: 'compass.workview' as const,
      completedStepIds: ['here.dashboard', 'here.primary-problem', 'here.why-now'] as StepId[],
    }
    const recorded = recordResponse(
      initial,
      { stepId: 'compass.workview', kind: 'text', text: '工作意味着有选择地创造。' },
      answeredAt,
    )
    const skipped = skipCoachMoment(recorded, '2026-08-27T08:02:00.000Z')

    expect(skipped.currentStepId).toBe('compass.lifeview')
    expect(skipped.responses.filter((item) => item.stepId === 'compass.workview')).toHaveLength(1)
    expect(skipped.coachTurns).toEqual([])
  })

  it('persists blueprint success and recovers an interrupted generation without deleting old content', () => {
    const complete = {
      ...createCheckpoint('blueprint-session', startedAt),
      hereGuidance: null,
      stage: 'complete' as const,
      currentStepId: null,
      completedStepIds: steps.map((step) => step.id),
      blueprint: {
        status: 'complete' as const,
        markdown: `# 旧蓝图\n\n${'这是已经完成并保存的旧版本内容，重新生成时必须保留。'.repeat(5)}`,
        generatedAt: answeredAt,
      },
    }
    const generating = beginBlueprint(complete, '2026-08-27T08:04:00.000Z')
    expect(generating.blueprint.markdown).toContain('旧蓝图')

    const recovered = recoverInterruptedBlueprint(generating, '2026-08-27T08:05:00.000Z')
    expect(recovered.blueprint.status).toBe('failed')
    expect(recovered.blueprint.markdown).toContain('旧蓝图')

    const failed = failBlueprint(recovered, '本地 Codex 暂时不可用', '2026-08-27T08:06:00.000Z')
    expect(failed.blueprint.error).toBe('本地 Codex 暂时不可用')

    const succeeded = completeBlueprint(
      beginBlueprint(failed, '2026-08-27T08:07:00.000Z'),
      `# 新蓝图\n\n${'这是一份根据完整人生设计素材生成的新蓝图，包含真实行动与复盘。'.repeat(5)}`,
      '2026-08-27T08:08:00.000Z',
    )
    expect(succeeded.blueprint.status).toBe('complete')
    expect(succeeded.blueprint.markdown).toContain('新蓝图')
    expect(succeeded.blueprint.error).toBeUndefined()
  })
})
