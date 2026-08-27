import 'fake-indexeddb/auto'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CheckpointRepository } from '@life-design/checkpoint'
import { createCheckpoint, recordResponse } from '@life-design/core'
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

  it('restores the exact next step after a new hook instance mounts', async () => {
    const repository = new CheckpointRepository('hook-restore-v2')
    repositories.push(repository)
    const first = renderHook(() => useLifeDesignSession(repository))
    await waitFor(() => expect(first.result.current.status).toBe('ready'))

    await act(async () => first.result.current.submitResponse(dashboardResponse))
    expect(first.result.current.step?.id).toBe('here.primary-problem')
    first.unmount()

    const second = renderHook(() => useLifeDesignSession(repository))
    await waitFor(() => expect(second.result.current.status).toBe('ready'))
    expect(second.result.current.step?.id).toBe('here.primary-problem')
    expect(second.result.current.checkpoint?.responses[0]).toEqual(dashboardResponse)
    second.unmount()
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
