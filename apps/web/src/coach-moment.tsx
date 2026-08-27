'use client'

import { useEffect, useRef, useState } from 'react'
import type { CoachAnchor, CoachTurn } from '@life-design/core'

type CoachMomentProps = {
  anchor: CoachAnchor
  turn: CoachTurn | null
  status: 'idle' | 'loading' | 'ready' | 'error'
  error: string | null
  onGenerate(): Promise<boolean>
  onContinue(answer?: string): Promise<boolean>
  onSkip(): Promise<boolean>
}

export function CoachMoment({
  anchor,
  turn,
  status,
  error,
  onGenerate,
  onContinue,
  onSkip,
}: CoachMomentProps) {
  const requested = useRef(false)
  const [answer, setAnswer] = useState(turn?.followUpAnswer ?? '')
  const [continuing, setContinuing] = useState(false)

  useEffect(() => {
    if (!turn && status === 'idle' && !requested.current) {
      requested.current = true
      void onGenerate()
    }
  }, [onGenerate, status, turn])

  async function continueJourney() {
    setContinuing(true)
    await onContinue(answer.trim() || undefined)
    setContinuing(false)
  }

  if (!turn && (status === 'idle' || status === 'loading')) {
    return (
      <section className="coach-card coach-loading" aria-live="polite">
        <p className="coach-kicker">答案已保存 · 本机 Codex</p>
        <h2>教练正在读你的回答</h2>
        <p>你的回答已经保存。现在只让模型看这一段和必要的上下文，帮你找到下一处值得深挖的线索。</p>
        <div className="thinking-line" aria-hidden="true"><span /></div>
      </section>
    )
  }

  if (!turn && status === 'error') {
    return (
      <section className="coach-card coach-error" aria-live="polite">
        <p className="coach-kicker">回答已经保存</p>
        <h2>这次回应没有生成出来</h2>
        <p>{error ?? '本机 Codex 暂时不可用。你的回答和断点都没有丢失。'}</p>
        <div className="coach-actions">
          <button onClick={() => onGenerate()}>重试回应</button>
          <button className="secondary-action" onClick={() => onSkip()}>
            先继续使用本地流程
          </button>
        </div>
      </section>
    )
  }

  if (!turn) return null

  return (
    <section className="coach-card" aria-live="polite" data-anchor={anchor}>
      <p className="coach-kicker">来自本机 Codex 的人生设计回应</p>
      <div className="coach-section">
        <span>我听见了什么</span>
        <p>{turn.acknowledgement}</p>
      </div>
      <div className="coach-section insight">
        <span>这里可能值得看一眼</span>
        <p>{turn.insight}</p>
      </div>
      <div className="coach-follow-up">
        <span>只追问一件事</span>
        <h2>{turn.followUp}</h2>
        <label>
          <span>想补充的话</span>
          <textarea
            aria-label="想补充的话"
            rows={4}
            value={answer}
            placeholder="写一个真实时刻、一件具体的事，或者当时的感受。也可以先不答。"
            onChange={(event) => setAnswer(event.target.value)}
          />
        </label>
      </div>
      <div className="coach-actions">
        <button disabled={continuing} onClick={continueJourney}>
          {continuing ? '正在保存…' : answer.trim() ? '补充并继续' : '继续下一步'}
        </button>
        {answer.trim() && (
          <button className="text-action" disabled={continuing} onClick={() => onContinue()}>
            先不补充
          </button>
        )}
      </div>
      <p className="coach-disclosure">
        本次素材会发送给这台电脑当前登录的 Codex，仅用于生成回应与人生设计蓝图。
      </p>
    </section>
  )
}
