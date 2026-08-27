'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckpointRepository } from '@life-design/checkpoint'
import {
  advanceAfterSavedAnswer,
  createCheckpoint,
  questions,
  recordAnswer,
  type LifeDesignCheckpoint,
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
        next = advanceAfterSavedAnswer(next, new Date().toISOString())
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

  const answer = useCallback(
    async (text: string) => {
      if (!checkpoint) return false
      setStatus('saving')
      setError(null)
      let answerWasSaved = false
      try {
        const recorded = recordAnswer(checkpoint, text, new Date().toISOString())
        await repository.save(recorded)
        answerWasSaved = true
        setCheckpoint(recorded)

        const advanced = advanceAfterSavedAnswer(recorded, new Date().toISOString())
        await repository.save(advanced)
        setCheckpoint(advanced)
        setStatus('ready')
        return true
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : '保存失败')
        setStatus('error')
        return answerWasSaved
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
    link.download = `life-design-checkpoint-${checkpoint.sessionId}.json`
    document.body.append(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(link.href)
  }, [checkpoint])

  const question = useMemo(
    () => questions.find((item) => item.id === checkpoint?.currentQuestionId) ?? null,
    [checkpoint?.currentQuestionId],
  )

  return { checkpoint, question, status, error, answer, exportCheckpoint }
}
