import 'fake-indexeddb/auto'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CheckpointRepository } from '@life-design/checkpoint'
import { createCheckpoint, recordResponse, type HereGuidance } from '@life-design/core'
import { useLifeDesignSession } from './use-life-design-session'

const dashboardResponse = {
  stepId: 'here.dashboard' as const,
  kind: 'dashboard' as const,
  scores: { health: 6, work: 3, play: 4, love: 8 },
}

describe('useLifeDesignSession', () => {
  const repositories: CheckpointRepository[] = []

  afterEach(async () => {
    for (const repository of repositories) {
      await repository.deleteDatabase()
    }
    repositories.length = 0
    localStorage.clear()
  })

  it('saves and restores the exact guided micro-step and draft', async () => {
    const repository = new CheckpointRepository('hook-restore-v3')
    repositories.push(repository)
    const first = renderHook(() => useLifeDesignSession(repository))
    await waitFor(() => expect(first.result.current.status).toBe('ready'))

    await act(async () =>
      first.result.current.saveHereDraft({
        currentMicroStepId: 'here.dashboard',
        feelings: [],
        feelingNote: '',
      }),
    )
    const focusDraft: HereGuidance = {
      currentMicroStepId: 'here.focus',
      scores: dashboardResponse.scores,
      feelings: [],
      feelingNote: '',
    }
    await act(async () => first.result.current.saveHereDraft(focusDraft))
    expect(first.result.current.checkpoint?.hereGuidance).toEqual(focusDraft)
    first.unmount()

    const second = renderHook(() => useLifeDesignSession(repository))
    await waitFor(() => expect(second.result.current.status).toBe('ready'))
    expect(second.result.current.checkpoint?.hereGuidance).toEqual(focusDraft)

    await act(async () => second.result.current.goBackHere())
    expect(second.result.current.checkpoint?.hereGuidance).toMatchObject({
      currentMicroStepId: 'here.dashboard',
      scores: dashboardResponse.scores,
    })
    second.unmount()
  })

  it('completes the guided stage and moves to the workview', async () => {
    const repository = new CheckpointRepository('hook-complete-v3')
    repositories.push(repository)
    const initial = createCheckpoint('guided-complete', '2026-08-27T08:00:00.000Z')
    await repository.save({
      ...initial,
      hereGuidance: {
        currentMicroStepId: 'here.summary',
        scores: dashboardResponse.scores,
        focus: 'work',
        problemShapeId: 'work.direction',
        problemStatement: '我想换方向，但不知道该往哪里走。',
        momentWindow: 'this-week',
        momentDetails: '周一开会时，我发现自己对接下来的项目完全提不起兴趣。',
        feelings: ['tired', 'lost'],
        feelingNote: '',
        boundaryType: 'mixed',
        nextAction: '约一位不同岗位的朋友聊聊真实工作日常。',
      },
    })
    localStorage.setItem('life-design-active-session', initial.sessionId)

    const hook = renderHook(() => useLifeDesignSession(repository))
    await waitFor(() => expect(hook.result.current.status).toBe('ready'))
    await act(async () =>
      hook.result.current.completeHere(
        '我听到的是：我想换一个更适合自己的工作方向，并先通过一次真实访谈获得信息。',
      ),
    )

    expect(hook.result.current.step?.id).toBe('compass.workview')
    expect(hook.result.current.checkpoint?.stageReflections.here).toContain('真实访谈')
    hook.unmount()
  })

  it('finishes a saved pending advance after a crash', async () => {
    const repository = new CheckpointRepository('hook-pending-v2')
    repositories.push(repository)
    const initial = createCheckpoint('session-pending', '2026-08-27T08:00:00.000Z')
    const recorded = recordResponse(
      initial,
      dashboardResponse,
      '2026-08-27T08:01:00.000Z',
    )
    await repository.save(recorded)
    localStorage.setItem('life-design-active-session', recorded.sessionId)

    const restored = renderHook(() => useLifeDesignSession(repository))
    await waitFor(() => expect(restored.result.current.status).toBe('ready'))
    expect(restored.result.current.step?.id).toBe('here.primary-problem')
    expect(restored.result.current.checkpoint?.responses).toHaveLength(1)
    restored.unmount()
  })
})
