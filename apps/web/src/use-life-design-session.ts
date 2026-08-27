'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckpointRepository } from '@life-design/checkpoint'
import {
  advanceAfterSavedResponse,
  completeCoachMoment,
  completeHereGuidance,
  createCheckpoint,
  getStep,
  goBackHereGuidance,
  recordResponse,
  recordCoachTurn,
  saveHereGuidance,
  skipCoachMoment as skipCoachMomentTransition,
  type HereGuidance,
  type LifeDesignCheckpoint,
  type LifeDesignResponse,
} from '@life-design/core'
import { requestCoach } from './local-codex-api'

const SESSION_KEY = 'life-design-active-session'

export function useLifeDesignSession(repository: CheckpointRepository) {
  const [checkpoint, setCheckpoint] = useState<LifeDesignCheckpoint | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [coachStatus, setCoachStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [coachError, setCoachError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const existingId = localStorage.getItem(SESSION_KEY)
      const restored = existingId ? await repository.load(existingId) : null
      let next = restored ?? createCheckpoint(crypto.randomUUID(), new Date().toISOString())
      if (!restored) await repository.save(next)
      if (next.pendingOperation && !next.coachPendingAfter) {
        next = advanceAfterSavedResponse(next, new Date().toISOString())
        await repository.save(next)
      }
      localStorage.setItem(SESSION_KEY, next.sessionId)
      if (!cancelled) {
        setCheckpoint(next)
        setStatus('ready')
        const hasSavedCoach = Boolean(
          next.coachPendingAfter &&
            next.coachTurns.some((turn) => turn.afterStepId === next.coachPendingAfter),
        )
        setCoachStatus(hasSavedCoach ? 'ready' : 'idle')
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

        setStatus('ready')
        setCoachStatus('idle')
        return true
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : '保存失败')
        setStatus('error')
        return responseWasSaved
      }
    },
    [checkpoint, repository],
  )

  const persistGuidedChange = useCallback(
    async (
      transition: (current: LifeDesignCheckpoint, now: string) => LifeDesignCheckpoint,
    ) => {
      if (!checkpoint) return false
      setStatus('saving')
      setError(null)
      try {
        const next = transition(checkpoint, new Date().toISOString())
        await repository.save(next)
        setCheckpoint(next)
        setStatus('ready')
        return true
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : '保存失败')
        setStatus('error')
        return false
      }
    },
    [checkpoint, repository],
  )

  const saveHereDraft = useCallback(
    (guidance: HereGuidance) =>
      persistGuidedChange((current, now) => saveHereGuidance(current, guidance, now)),
    [persistGuidedChange],
  )

  const goBackHere = useCallback(
    () => persistGuidedChange((current, now) => goBackHereGuidance(current, now)),
    [persistGuidedChange],
  )

  const completeHere = useCallback(
    async (reflection: string) => {
      const saved = await persistGuidedChange((current, now) =>
        completeHereGuidance(current, reflection, now),
      )
      if (saved) setCoachStatus('idle')
      return saved
    },
    [persistGuidedChange],
  )

  const generateCoachMoment = useCallback(async () => {
    if (!checkpoint?.coachPendingAfter) return false
    const existing = checkpoint.coachTurns.find(
      (turn) => turn.afterStepId === checkpoint.coachPendingAfter,
    )
    if (existing) {
      setCoachStatus('ready')
      return true
    }
    setCoachStatus('loading')
    setCoachError(null)
    try {
      const draft = await requestCoach({
        anchor: checkpoint.coachPendingAfter,
        checkpoint,
      })
      const next = recordCoachTurn(checkpoint, draft, new Date().toISOString())
      await repository.save(next)
      setCheckpoint(next)
      setCoachStatus('ready')
      return true
    } catch (cause) {
      setCoachError(cause instanceof Error ? cause.message : '本机 Codex 暂时不可用')
      setCoachStatus('error')
      return false
    }
  }, [checkpoint, repository])

  const continueAfterCoach = useCallback(
    async (followUpAnswer?: string) => {
      if (!checkpoint) return false
      setStatus('saving')
      setError(null)
      try {
        const next = completeCoachMoment(
          checkpoint,
          followUpAnswer,
          new Date().toISOString(),
        )
        await repository.save(next)
        setCheckpoint(next)
        setStatus('ready')
        setCoachStatus('idle')
        setCoachError(null)
        return true
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : '保存补充回答失败')
        setStatus('error')
        return false
      }
    },
    [checkpoint, repository],
  )

  const skipCoachMoment = useCallback(async () => {
    if (!checkpoint) return false
    setStatus('saving')
    setError(null)
    try {
      const next = skipCoachMomentTransition(checkpoint, new Date().toISOString())
      await repository.save(next)
      setCheckpoint(next)
      setStatus('ready')
      setCoachStatus('idle')
      setCoachError(null)
      return true
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '无法继续')
      setStatus('error')
      return false
    }
  }, [checkpoint, repository])

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

  const activeCoachTurn = useMemo(
    () =>
      checkpoint?.coachPendingAfter
        ? checkpoint.coachTurns.find(
            (turn) => turn.afterStepId === checkpoint.coachPendingAfter,
          ) ?? null
        : null,
    [checkpoint],
  )

  return {
    checkpoint,
    step,
    status,
    error,
    coachStatus,
    coachError,
    activeCoachTurn,
    submitResponse,
    saveHereDraft,
    goBackHere,
    completeHere,
    generateCoachMoment,
    continueAfterCoach,
    skipCoachMoment,
    exportCheckpoint,
  }
}
