import 'fake-indexeddb/auto'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CheckpointRepository } from '@life-design/checkpoint'
import { createCheckpoint, recordAnswer } from '@life-design/core'
import { useLifeDesignSession } from './use-life-design-session'

describe('useLifeDesignSession', () => {
  const repositories: CheckpointRepository[] = []

  afterEach(async () => {
    for (const repository of repositories) {
      await repository.deleteDatabase()
    }
    repositories.length = 0
    localStorage.clear()
  })

  it('restores the exact next question after a new hook instance mounts', async () => {
    const repository = new CheckpointRepository('hook-restore')
    repositories.push(repository)
    const first = renderHook(() => useLifeDesignSession(repository))
    await waitFor(() => expect(first.result.current.status).toBe('ready'))

    await act(async () => first.result.current.answer('健康 6，工作 3，娱乐 4，爱 8。'))
    expect(first.result.current.question?.id).toBe('here.primary-problem')
    first.unmount()

    const second = renderHook(() => useLifeDesignSession(repository))
    await waitFor(() => expect(second.result.current.status).toBe('ready'))
    expect(second.result.current.question?.id).toBe('here.primary-problem')
    expect(second.result.current.checkpoint?.answers[0]?.text).toBe(
      '健康 6，工作 3，娱乐 4，爱 8。',
    )
    second.unmount()
  })

  it('finishes a saved pending advance after a crash', async () => {
    const repository = new CheckpointRepository('hook-pending')
    repositories.push(repository)
    const initial = createCheckpoint('session-pending', '2026-08-27T08:00:00.000Z')
    const recorded = recordAnswer(initial, '工作 3 分。', '2026-08-27T08:01:00.000Z')
    await repository.save(recorded)
    localStorage.setItem('life-design-active-session', recorded.sessionId)

    const restored = renderHook(() => useLifeDesignSession(repository))
    await waitFor(() => expect(restored.result.current.status).toBe('ready'))
    expect(restored.result.current.question?.id).toBe('here.primary-problem')
    expect(restored.result.current.checkpoint?.answers).toHaveLength(1)
    restored.unmount()
  })
})
