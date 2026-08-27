import { describe, expect, it } from 'vitest'
import {
  advanceAfterSavedAnswer,
  createCheckpoint,
  recordAnswer,
} from './session'

describe('life-design session', () => {
  it('starts at the first question without answers', () => {
    const state = createCheckpoint('session-1', '2026-08-27T08:00:00.000Z')
    expect(state.currentQuestionId).toBe('here.dashboard')
    expect(state.answers).toEqual([])
    expect(state.revision).toBe(1)
  })

  it('records the exact user answer before changing the question', () => {
    const initial = createCheckpoint('session-1', '2026-08-27T08:00:00.000Z')
    const saved = recordAnswer(initial, '工作 4 分，爱 8 分。', '2026-08-27T08:01:00.000Z')
    expect(saved.currentQuestionId).toBe('here.dashboard')
    expect(saved.answers[0]?.text).toBe('工作 4 分，爱 8 分。')
    expect(saved.pendingOperation?.type).toBe('advance-question')
  })

  it('advances only from a durably recorded answer', () => {
    const initial = createCheckpoint('session-1', '2026-08-27T08:00:00.000Z')
    expect(() => advanceAfterSavedAnswer(initial, '2026-08-27T08:01:30.000Z')).toThrow(
      'No saved answer is waiting to advance',
    )
    const saved = recordAnswer(initial, '工作让我最焦虑。', '2026-08-27T08:01:00.000Z')
    const advanced = advanceAfterSavedAnswer(saved, '2026-08-27T08:01:30.000Z')
    expect(advanced.currentQuestionId).toBe('here.primary-problem')
    expect(advanced.pendingOperation).toBeNull()
  })
})
