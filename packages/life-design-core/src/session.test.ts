import { describe, expect, it } from 'vitest'
import { steps } from './steps'
import {
  advanceAfterSavedResponse,
  createCheckpoint,
  isReadyForBlueprint,
  migrateCheckpoint,
  recordResponse,
} from './session'

const startedAt = '2026-08-27T08:00:00.000Z'
const answeredAt = '2026-08-27T08:01:00.000Z'

describe('four-stage life-design session', () => {
  it('starts a v3 checkpoint at the guided welcome micro-step', () => {
    const checkpoint = createCheckpoint('session-1', startedAt)

    expect(checkpoint.schemaVersion).toBe(3)
    expect(checkpoint.hereGuidance).toMatchObject({
      currentMicroStepId: 'here.welcome',
      feelings: [],
      feelingNote: '',
    })
    expect(checkpoint.currentStepId).toBe('here.dashboard')
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
      checkpoint = advanceAfterSavedResponse(checkpoint, answeredAt)
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

    expect(migrated.schemaVersion).toBe(3)
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
})
