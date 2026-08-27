import 'fake-indexeddb/auto'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CheckpointRepository } from '@life-design/checkpoint'
import { checkpointSchema, createCheckpoint, recordResponse, type HereGuidance } from '@life-design/core'
import { useLifeDesignSession } from './use-life-design-session'

const { requestCoachMock, requestBlueprintMock } = vi.hoisted(() => ({
  requestCoachMock: vi.fn(),
  requestBlueprintMock: vi.fn(),
}))

vi.mock('./local-codex-api', () => ({
  requestCoach: requestCoachMock,
  requestBlueprint: requestBlueprintMock,
}))

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
    requestCoachMock.mockReset()
    requestBlueprintMock.mockReset()
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
    expect(hook.result.current.checkpoint?.coachPendingAfter).toBe('here.guided')
    hook.unmount()
  })

  it('restores a saved answer at its pending coach moment after a crash', async () => {
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
    expect(restored.result.current.step?.id).toBe('here.dashboard')
    expect(restored.result.current.checkpoint?.coachPendingAfter).toBe('here.dashboard')
    expect(restored.result.current.checkpoint?.responses).toHaveLength(1)
    restored.unmount()
  })

  it('saves before requesting a coach response and advances only after the user continues', async () => {
    const repository = new CheckpointRepository('hook-coach-v4')
    repositories.push(repository)
    const created = createCheckpoint('coach-flow', '2026-08-27T08:00:00.000Z')
    const compass = checkpointSchema.parse({
      ...created,
      stage: 'compass',
      currentStepId: 'compass.workview',
      completedStepIds: ['here.dashboard', 'here.primary-problem', 'here.why-now'],
      hereGuidance: null,
    })
    await repository.save(compass)
    localStorage.setItem('life-design-active-session', compass.sessionId)
    requestCoachMock.mockImplementation(async () => {
      const persisted = await repository.load(compass.sessionId)
      expect(persisted?.coachPendingAfter).toBe('compass.workview')
      expect(persisted?.responses.some((item) => item.stepId === 'compass.workview')).toBe(true)
      return {
        acknowledgement: '你把工作看成一种创造价值，同时保有选择空间的方式。',
        insight: '这里可能存在自主、稳定和影响力之间需要被看见的排序。',
        followUp: '最近哪一次工作经历最接近你说的理想状态？',
      }
    })

    const hook = renderHook(() => useLifeDesignSession(repository))
    await waitFor(() => expect(hook.result.current.status).toBe('ready'))
    await act(async () => {
      await hook.result.current.submitResponse({
        stepId: 'compass.workview',
        kind: 'text',
        text: '工作是创造价值，同时保有选择空间。',
      })
    })
    expect(hook.result.current.step?.id).toBe('compass.workview')
    expect(hook.result.current.checkpoint?.coachPendingAfter).toBe('compass.workview')

    await act(async () => {
      await hook.result.current.generateCoachMoment()
    })
    expect(hook.result.current.checkpoint?.coachTurns).toHaveLength(1)
    expect(hook.result.current.step?.id).toBe('compass.workview')

    await act(async () => {
      await hook.result.current.continueAfterCoach('一次从零搭建产品原型的经历。')
    })
    expect(hook.result.current.step?.id).toBe('compass.lifeview')
    expect(hook.result.current.checkpoint?.coachTurns[0]?.followUpAnswer).toContain('产品原型')
    hook.unmount()
  })

  it('persists blueprint generation before the request and saves the completed markdown', async () => {
    const repository = new CheckpointRepository('hook-blueprint-v4')
    repositories.push(repository)
    const created = createCheckpoint('blueprint-flow', '2026-08-27T08:00:00.000Z')
    const complete = checkpointSchema.parse({
      ...created,
      stage: 'complete',
      currentStepId: null,
      completedStepIds: [
        'here.dashboard',
        'here.primary-problem',
        'here.why-now',
        'compass.workview',
        'compass.lifeview',
        'wayfinding.energy-map',
        'odyssey.plans',
        'odyssey.prototype',
      ],
      hereGuidance: null,
    })
    await repository.save(complete)
    localStorage.setItem('life-design-active-session', complete.sessionId)
    const markdown = `# 我的人生设计蓝图\n\n${'这是一段只根据用户真实素材形成的完整蓝图内容。'.repeat(10)}`
    requestBlueprintMock.mockImplementation(async () => {
      const persisted = await repository.load(complete.sessionId)
      expect(persisted?.blueprint.status).toBe('generating')
      return { title: '我的人生设计蓝图', markdown }
    })

    const hook = renderHook(() => useLifeDesignSession(repository))
    await waitFor(() => expect(hook.result.current.status).toBe('ready'))
    await act(async () => {
      await hook.result.current.generateBlueprint()
    })

    expect(hook.result.current.checkpoint?.blueprint.status).toBe('complete')
    expect(hook.result.current.checkpoint?.blueprint.markdown).toBe(markdown)
    hook.unmount()
  })

  it('turns an interrupted blueprint generation into a retryable saved failure', async () => {
    const repository = new CheckpointRepository('hook-blueprint-recovery-v4')
    repositories.push(repository)
    const created = createCheckpoint('blueprint-recovery', '2026-08-27T08:00:00.000Z')
    await repository.save(
      checkpointSchema.parse({
        ...created,
        stage: 'complete',
        currentStepId: null,
        hereGuidance: null,
        blueprint: { status: 'generating' },
      }),
    )
    localStorage.setItem('life-design-active-session', created.sessionId)

    const hook = renderHook(() => useLifeDesignSession(repository))
    await waitFor(() => expect(hook.result.current.status).toBe('ready'))
    expect(hook.result.current.checkpoint?.blueprint.status).toBe('failed')
    expect(hook.result.current.checkpoint?.blueprint.error).toContain('中断')
    hook.unmount()
  })
})
