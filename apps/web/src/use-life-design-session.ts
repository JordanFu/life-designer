'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckpointRepository } from '@life-design/checkpoint'
import {
  advanceAfterSavedResponse,
  createCheckpoint,
  getStep,
  recordResponse,
  type LifeDesignCheckpoint,
  type LifeDesignResponse,
} from '@life-design/core'

const SESSION_KEY = 'life-design-active-session'

export function useLifeDesignSession(repository: CheckpointRepository) {
  const [checkpoint, setCheckpoint] = useState<LifeDesignCheckpoint | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const existingId = localStorage.getItem(SESSION_KEY)
      const restored = existingId ? await repository.load(existingId) : null
      let next = restored ?? createCheckpoint(crypto.randomUUID(), new Date().toISOString())
      if (!restored) await repository.save(next)
      if (next.pendingOperation) {
        next = advanceAfterSavedResponse(next, new Date().toISOString())
        await repository.save(next)
      }
      localStorage.setItem(SESSION_KEY, next.sessionId)
      if (!cancelled) {
        setCheckpoint(next)
        setStatus('ready')
      }
    }

    load().catch((cause: unknown) => {
      if (!cancelled) {
        setError(cause instanceof Error ? cause.message : '无法读取进度')
        setStatus('error')
      }
    })

    return () => {
      cancelled = true
    }
  }, [repository])

  const submitResponse = useCallback(
    async (response: LifeDesignResponse) => {
      if (!checkpoint) return false
      setStatus('saving')
      setError(null)
      let responseWasSaved = false
      try {
        const recorded = recordResponse(checkpoint, response, new Date().toISOString())
        await repository.save(recorded)
        responseWasSaved = true
        setCheckpoint(recorded)

        const advanced = advanceAfterSavedResponse(recorded, new Date().toISOString())
        await repository.save(advanced)
        setCheckpoint(advanced)
        setStatus('ready')
        return true
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : '保存失败')
        setStatus('error')
        return responseWasSaved
      }
    },
    [checkpoint, repository],
  )

  const exportCheckpoint = useCallback(() => {
    if (!checkpoint) return
    const blob = new Blob([JSON.stringify(checkpoint, null, 2)], {
      type: 'application/json',
    })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `life-design-materials-${checkpoint.sessionId}.json`
    document.body.append(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(link.href)
  }, [checkpoint])

  const step = useMemo(
    () => getStep(checkpoint?.currentStepId ?? null),
    [checkpoint?.currentStepId],
  )

  return { checkpoint, step, status, error, submitResponse, exportCheckpoint }
}
